const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const defaultIDEPaths = require('./defaultIDEPaths');
const configPanel = require('./configPanel');

let statusBarItem;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	console.log('Congratulations, your extension "editorjumper" is now active!');

	const config = vscode.workspace.getConfiguration('editorjumper');
	const currentIDE = config.get('selectedIDE');
	const ideConfigurations = config.get('ideConfigurations');

	if (!currentIDE || !ideConfigurations.find(ide => ide.name === currentIDE)) {
		if (ideConfigurations.length > 0) {
			await config.update('selectedIDE', ideConfigurations[0].name, true);
		}
	}

	// 创建状态栏项 - 用于选择IDE
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'editorjumper.selectJetBrainsIDE';
	context.subscriptions.push(statusBarItem);

	// 创建配置按钮 - 用于打开配置界面
	const configButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	configButton.text = '$(gear)';
	configButton.tooltip = 'Configure EditorJumper';
	configButton.command = 'editorjumper.configureIDE';
	context.subscriptions.push(configButton);
	configButton.show();

	updateStatusBar();

	// 注册命令：选择IDE
	let selectIDECommand = vscode.commands.registerCommand('editorjumper.selectJetBrainsIDE', async () => {
		const config = vscode.workspace.getConfiguration('editorjumper');
		const ideConfigurations = config.get('ideConfigurations');
		
		// 创建IDE选项列表
		const items = ideConfigurations
			.filter(ide => !ide.hidden) // 只显示未隐藏的IDE
			.map(ide => ({
				label: ide.name,
				description: ide.isCustom ? '(Custom)' : '',
				name: ide.name
			}));
		
		// 添加配置选项
		items.push({
			label: '$(gear) Configure EditorJumper',
			description: 'Open configuration panel',
			name: 'configure'
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select JetBrains IDE or Configure'
		});

		if (selected) {
			if (selected.name === 'configure') {
				// 打开配置界面
				vscode.commands.executeCommand('editorjumper.configureIDE');
			} else {
				// 选择IDE
				await config.update('selectedIDE', selected.name, true);
				updateStatusBar();
			}
		}
	});

	// 注册命令：在JetBrains中打开
	let openInJetBrainsCommand = vscode.commands.registerCommand('editorjumper.openInJetBrains', async (uri) => {
		const config = vscode.workspace.getConfiguration('editorjumper');
		const selectedIDE = config.get('selectedIDE');
		const ideConfigurations = config.get('ideConfigurations');
		const ideConfig = ideConfigurations.find(ide => ide.name === selectedIDE);

		if (!ideConfig) {
			vscode.window.showErrorMessage('Please select a JetBrains IDE first');
			return;
		}

		let filePath;
		let lineNumber = 0;
		let columnNumber = 0;

		// 检查命令的触发来源
		const editor = vscode.window.activeTextEditor;

		if (uri) {
			try {
			  // 获取文件或文件夹的元信息
			  const stat = await vscode.workspace.fs.stat(uri);
	  
			  // 判断是文件还是文件夹
			  if (stat.type === vscode.FileType.File) {
				filePath = uri.fsPath;
			  }
			} catch (error) {
				console.error('Error checking file/directory status:', error);
			}
		} else if (editor) {
			filePath = editor.document.uri.fsPath;
			lineNumber = editor.selection.active.line + 1;
			// 获取列号，考虑 tab 字符的宽度
			const position = editor.selection.active;
			const line = editor.document.lineAt(position.line).text;
			for (let i = 0; i < position.character; i++) {
				if (line[i] === '\t') {
					columnNumber += 4;
				} else {
					columnNumber += 1;
				}
			}
		}

		// 获取项目根目录
		let projectPath;

		// 获取当前工作区文件夹
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			// 如果有工作区文件夹，使用第一个工作区文件夹的路径
			projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

			// 如果有多个工作区文件夹，并且有选中的文件，尝试找到包含该文件的工作区文件夹
			if (vscode.workspace.workspaceFolders.length > 1 && filePath) {
				const fileUri = vscode.Uri.file(filePath);
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
				if (workspaceFolder) {
					projectPath = workspaceFolder.uri.fsPath;
				}
			}
		} else {
			// 如果没有工作区文件夹，提示用户并返回
			vscode.window.showErrorMessage('No workspace folder is open. Please open a project first.');
			return;
		}

		// 获取命令路径
		let commandPath = '';
		const platform = process.platform;
		// 获取命令路径，优先使用用户配置的路径，否则使用默认路径
		commandPath = ideConfig.commandPath || defaultIDEPaths[ideConfig.name]?.[platform];

		// 如果没有找到命令路径，提示用户配置
		if (!commandPath) {
			const result = await vscode.window.showErrorMessage(
				`Path for ${ideConfig.name} is not configured. Would you like to configure it now?`,
				'Configure', 'Cancel'
			);

			if (result === 'Configure') {
				const panel = configPanel.createConfigurationPanel(context);
				// 高亮显示需要配置的IDE
				configPanel.highlightIDE(ideConfig.name);
			}
			return;
		}

		// 判断命令路径是否为文件路径
		const commandPathIsFilePath = commandPath.includes('/') || commandPath.includes('\\');
		const fileExists = commandPathIsFilePath && fs.existsSync(commandPath);

		// 构建命令
		let command = '';
		let args = [];

		// 根据平台和命令类型构建命令和参数
		if (platform === 'darwin') {
			// macOS上使用open命令启动应用程序
			command = 'open';
			// 确保commandPath是.app文件路径
			if (!commandPath.endsWith('.app')) {
				vscode.window.showErrorMessage(`On macOS, you must select a complete application path (.app file)`);
				return;
			}

			// 使用数组构建参数，避免路径中的空格问题
			args = ['-a', commandPath, '--args', projectPath];

			// 如果有具体文件路径，添加文件相关参数
			if (filePath) {
				if (lineNumber > 0 || columnNumber > 0) {
					args.push('--line', lineNumber.toString(), '--column', columnNumber.toString(), filePath);
				} else {
					args.push(filePath);
				}
			}
		} else if (platform === 'win32' && !commandPathIsFilePath) {
			// Windows上使用cmd启动命令
			command = 'cmd';
			args = ['/c', commandPath, projectPath];

			// 如果有具体文件路径，添加文件相关参数
			if (filePath) {
				if (lineNumber > 0 || columnNumber > 0) {
					args.push('--line', lineNumber.toString(), '--column', columnNumber.toString(), filePath);
				} else {
					args.push(filePath);
				}
			}
		} else {
			// 其他情况直接使用命令路径
			command = commandPath;
			args = [projectPath];

			// 如果有具体文件路径，添加文件相关参数
			if (filePath) {
				if (lineNumber > 0 || columnNumber > 0) {
					args.push('--line', lineNumber.toString(), '--column', columnNumber.toString(), filePath);
				} else {
					args.push(filePath);
				}
			}
		}

		// 执行命令
		console.log('Executing command:', command, args);
		try {
			// 构建完整命令，确保正确处理空格
			let fullCommand = '';
			
			// 构建文件路径参数部分（所有平台通用）
			let filePathArgs = '';
			if (filePath) {
				if (lineNumber > 0 || columnNumber > 0) {
					filePathArgs = `--line ${lineNumber} --column ${columnNumber} "${filePath}"`;
				} else {
					filePathArgs = `"${filePath}"`;
				}
			}
			
			// 根据平台构建命令
			if (platform === 'darwin') {
				// macOS上，使用引号包裹路径
				fullCommand = `${command} -a "${commandPath}" --args "${projectPath}" ${filePathArgs}`;
			} else if (platform === 'win32' && !commandPathIsFilePath) {
				// Windows上，使用引号包裹路径
				fullCommand = `${command} /c ${commandPath} "${projectPath}" ${filePathArgs}`;
			} else {
				// 其他情况，使用引号包裹路径
				fullCommand = `"${commandPath}" "${projectPath}" ${filePathArgs}`;
			}
			
			console.log('Full command:', fullCommand);
			
			// 使用exec执行命令
			exec(fullCommand, {
				cwd: projectPath,
				shell: true,
				windowsHide: true
			}, (error, stdout, stderr) => {
				if (error) {
					console.error('Command execution error:', error);
					vscode.window.showErrorMessage(`Failed to launch IDE: ${error.message}`);
					return;
				}
				if (stderr) {
					console.error('Command execution warning:', stderr);
				}
				if (stdout) {
					console.log('Command output:', stdout);
				}
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to start IDE process: ${error.message}`);
		}
	});

	// 注册新的配置命令
	let configureIDECommand = vscode.commands.registerCommand('editorjumper.configureIDE', () => {
		configPanel.createConfigurationPanel(context);
	});

	// 注册更新状态栏命令
	let updateStatusBarCommand = vscode.commands.registerCommand('editorjumper.updateStatusBar', () => {
		updateStatusBar();
	});

	context.subscriptions.push(selectIDECommand);
	context.subscriptions.push(openInJetBrainsCommand);
	context.subscriptions.push(configureIDECommand);
	context.subscriptions.push(updateStatusBarCommand);

	// 监听配置变化
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('editorjumper')) {
			updateStatusBar();
		}
	}));

	// 初始显示状态栏
	statusBarItem.show();
}

function updateStatusBar() {
	const config = vscode.workspace.getConfiguration('editorjumper');
	const selectedIDE = config.get('selectedIDE');
	const ideConfigurations = config.get('ideConfigurations');
	const currentIDE = ideConfigurations.find(ide => ide.name === selectedIDE);

	if (currentIDE) {
		statusBarItem.text = `$(link-external) ${currentIDE.name}`;
		statusBarItem.tooltip = `Click to select JetBrains IDE (Current: ${currentIDE.name})`;
	} else {
		statusBarItem.text = '$(link-external) Select IDE';
		statusBarItem.tooltip = 'Click to select JetBrains IDE';
	}
}

// This method is called when your extension is deactivated
function deactivate() {
	if (statusBarItem) {
		statusBarItem.dispose();
	}
}

module.exports = {
	activate,
	deactivate
}
