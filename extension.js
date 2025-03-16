const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const defaultIDEPaths = require('./defaultIDEPaths');

let statusBarItem;
let configPanel = undefined;

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
		const items = ideConfigurations
			.filter(ide => !ide.hidden) // 只显示未隐藏的IDE
			.map(ide => ({
			label: ide.name,
				description: ide.isCustom ? '(Custom)' : '',
				name: ide.name
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select JetBrains IDE'
		});

		if (selected) {
			await config.update('selectedIDE', selected.name, true);
			updateStatusBar();
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
		let lineNumber;

		// 处理不同来源的调用
		if (uri) {
			// 来自文件资源管理器的右键点击或快捷键
			filePath = uri.fsPath;
		} else {
			// 来自编辑器的右键点击或快捷键
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				filePath = editor.document.uri.fsPath;
				lineNumber = editor.selection.active.line + 1;
			} else if (vscode.window.activeTextEditor) {
				// 如果是在编辑器中但没有选中文件
				filePath = vscode.window.activeTextEditor.document.uri.fsPath;
			} else {
				// 尝试从资源管理器获取选中的文件
				const explorerSelection = await getExplorerSelection();
				if (explorerSelection) {
					filePath = explorerSelection.fsPath;
				}
			}
		}

		if (!filePath) {
			vscode.window.showErrorMessage('Unable to get file path');
			return;
		}

		// 获取项目根目录
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri));
		const projectPath = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(filePath);

		// 获取命令路径
		let commandPath = '';
		const platform = process.platform;
		
		// 根据平台选择正确的命令
		if (platform === 'darwin') {
			// macOS: 如果是自定义IDE，使用用户配置的路径，否则使用默认路径
			commandPath = ideConfig.isCustom ? ideConfig.macCommand : defaultIDEPaths[ideConfig.name]?.darwin;
		} else if (platform === 'win32') {
			// Windows: 优先使用用户配置的路径，如果没有则使用默认路径
			commandPath = ideConfig.windowsCommand || defaultIDEPaths[ideConfig.name]?.win32;
		} else {
			// Linux: 优先使用用户配置的路径，如果没有则使用默认路径
			commandPath = ideConfig.linuxCommand || defaultIDEPaths[ideConfig.name]?.linux;
		}

		// 如果没有找到命令路径，提示用户配置
		if (!commandPath) {
			const result = await vscode.window.showErrorMessage(
				`Path for ${ideConfig.name} is not configured. Would you like to configure it now?`,
				'Configure', 'Cancel'
			);
			
			if (result === 'Configure') {
				createConfigurationPanel(context);
				// 高亮显示需要配置的IDE
				configPanel.webview.postMessage({
					command: 'highlightIDE',
					ideName: ideConfig.name
				});
			}
			return;
		}

		// 判断命令路径是否为文件路径
		const fs = require('fs');
		const commandPathIsFilePath = commandPath.includes('/') || commandPath.includes('\\');
		const fileExists = commandPathIsFilePath && fs.existsSync(commandPath);
		
		// 构建命令
		let fullCommand = '';
		let columnNumber = 0;
		
		// if (vscode.window.activeTextEditor) {
		// 	const editor = vscode.window.activeTextEditor;
		// 	const position = editor.selection.active;
		// 	const line = editor.document.lineAt(position.line).text;
		//
		// 	// 计算列号，考虑tab字符的宽度
		// 	columnNumber = 0; // 从0开始计数
		// 	for (let i = 0; i < position.character; i++) {
		// 		if (line[i] === '\t') {
		// 			// 对于JetBrains IDE，每个tab需要加上3个额外的列数
		// 			columnNumber += 4; // 1(字符本身) + 3(额外宽度)
		// 		} else {
		// 			columnNumber += 1;
		// 		}
		// 	}
		// }
		
		if (filePath && lineNumber && columnNumber) {
			// 如果有文件路径和光标位置，则打开项目并定位到文件的具体行列
			const fileWithPosition = `${filePath}:${lineNumber}:${columnNumber}`;
			if (platform === 'win32' && !commandPathIsFilePath) {
				fullCommand = `cmd /c ${commandPath} --line ${lineNumber} --column ${columnNumber} ${filePath}`;
			} else {
				// 对于macOS、Linux或者是完整路径的情况
				fullCommand = `${commandPath} --line ${lineNumber} --column ${columnNumber} ${filePath}`;
			}
		} else if (filePath) {
			// 如果只有文件路径，则打开项目并定位到文件
			if (platform === 'win32' && !commandPathIsFilePath) {
				fullCommand = `cmd /c ${commandPath} ${filePath}`;
			} else {
				// 对于macOS、Linux或者是完整路径的情况
				fullCommand = `${commandPath} ${filePath}`;
			}
		} else {
			// 如果没有文件路径，则只打开项目
			if (platform === 'win32' && !commandPathIsFilePath) {
				fullCommand = `cmd /c ${commandPath} ${projectPath}`;
			} else {
				// 对于macOS、Linux或者是完整路径的情况
				fullCommand = `${commandPath} ${projectPath}`;
			}
		}

		// 执行命令
		exec(fullCommand, (error) => {
			if (error) {
				vscode.window.showErrorMessage(`Unable to open ${ideConfig.name}: ${error.message}`);
			}
		});
	});

	// 注册新的配置命令
	let configureIDECommand = vscode.commands.registerCommand('editorjumper.configureIDE', () => {
		createConfigurationPanel(context);
	});

	context.subscriptions.push(selectIDECommand);
	context.subscriptions.push(openInJetBrainsCommand);
	context.subscriptions.push(configureIDECommand);

	// 监听配置变化
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('editorjumper')) {
			updateStatusBar();
		}
	}));

	// 初始显示状态栏
	statusBarItem.show();
}

// 获取资源管理器中选中的文件
async function getExplorerSelection() {
	try {
		const explorerItems = await vscode.commands.executeCommand('_workbench.getExplorerSelection');
		if (explorerItems && explorerItems.length > 0) {
			return explorerItems[0];
		}
	} catch (error) {
		console.error('获取资源管理器选择失败:', error);
	}
	return null;
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

// 创建配置面板
function createConfigurationPanel(context) {
	if (configPanel) {
		configPanel.dispose(); // 先销毁旧的面板
	}

	configPanel = vscode.window.createWebviewPanel(
		'ideConfiguration',
		'EditorJumper Configuration',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	const config = vscode.workspace.getConfiguration('editorjumper');
	configPanel.webview.html = getWebviewContent(config.get('ideConfigurations'));

	configPanel.webview.onDidReceiveMessage(
		async message => {
			const config = vscode.workspace.getConfiguration('editorjumper');
			const ideConfigurations = config.get('ideConfigurations');
			
			console.log('Received message from webview:', message.command, message);
			
			try {
				switch (message.command) {
					case 'addIDE':
						const newIDE = message.ide;
						console.log('Adding new IDE:', newIDE);
						
						// 检查是否存在相同名称的非自定义IDE
						if (newIDE.isCustom === false && ideConfigurations.some(ide => 
							ide.isCustom === false && ide.name === newIDE.name)) {
							vscode.window.showErrorMessage(`IDE ${newIDE.name} already exists`);
							return;
						}
						
						// 如果是编辑现有IDE，保留其他平台的命令路径
						const existingIDE = ideConfigurations.find(ide => ide.name === newIDE.name);
						let updatedIDE = {
							...newIDE,
							isCustom: newIDE.isCustom === true,
							hidden: newIDE.hidden === true
						};
						
						if (existingIDE) {
							// 保留其他平台的命令路径
							if (process.platform === 'darwin') {
								updatedIDE.windowsCommand = existingIDE.windowsCommand || '';
								updatedIDE.linuxCommand = existingIDE.linuxCommand || '';
							} else if (process.platform === 'win32') {
								updatedIDE.macCommand = existingIDE.macCommand || '';
								updatedIDE.linuxCommand = existingIDE.linuxCommand || '';
							} else {
								updatedIDE.macCommand = existingIDE.macCommand || '';
								updatedIDE.windowsCommand = existingIDE.windowsCommand || '';
							}
							
							// 更新现有IDE
							const updatedConfigurations = ideConfigurations.map(ide => 
								ide.name === newIDE.name ? updatedIDE : ide
							);
							await config.update('ideConfigurations', updatedConfigurations, true);
						} else {
							// 添加新IDE
							await config.update('ideConfigurations', [...ideConfigurations, updatedIDE], true);
						}
						
						vscode.window.showInformationMessage(`IDE configuration saved: ${newIDE.name}`);
						
						// 重新获取最新配置并更新WebView
						const addUpdatedConfig = vscode.workspace.getConfiguration('editorjumper');
						configPanel.webview.html = getWebviewContent(addUpdatedConfig.get('ideConfigurations'));
						updateStatusBar();
						break;
					case 'updateIDE':
						console.log('Updating IDE:', message.ide);
						const updatedConfigurations = ideConfigurations.map(ide => 
							ide.name === message.ide.name ? {
								...ide,
								...message.ide,
								isCustom: message.ide.isCustom === true,
								hidden: message.ide.hidden === true
							} : ide
						);
						await config.update('ideConfigurations', updatedConfigurations, true);
						
						// 如果当前选中的IDE被隐藏了，自动选择第一个未隐藏的IDE
						const selectedIDEForUpdate = config.get('selectedIDE');
						if (message.ide.name === selectedIDEForUpdate && message.ide.hidden === true) {
							const firstVisibleIDE = updatedConfigurations.find(ide => !ide.hidden);
							if (firstVisibleIDE) {
								await config.update('selectedIDE', firstVisibleIDE.name, true);
							}
						}
						
						// 重新获取最新配置并更新WebView
						const updateUpdatedConfig = vscode.workspace.getConfiguration('editorjumper');
						configPanel.webview.html = getWebviewContent(updateUpdatedConfig.get('ideConfigurations'));
						updateStatusBar();
						break;
					case 'removeIDE':
						console.log('Removing IDE:', message.ideName);
						const selectedIDEForRemove = config.get('selectedIDE');
						if (message.ideName === selectedIDEForRemove) {
							console.log('Cannot remove currently selected IDE');
							vscode.window.showErrorMessage('Cannot remove currently selected IDE. Please select another IDE first');
							return;
						}
						const filteredConfigurations = ideConfigurations.filter(ide => ide.name !== message.ideName);
						console.log('Filtered configurations:', filteredConfigurations);
						await config.update('ideConfigurations', filteredConfigurations, true);
						vscode.window.showInformationMessage('IDE configuration removed');
						
						// 重新获取最新配置并更新WebView
						const updatedConfig = vscode.workspace.getConfiguration('editorjumper');
						configPanel.webview.html = getWebviewContent(updatedConfig.get('ideConfigurations'));
						updateStatusBar();
						break;
					case 'selectIDE':
						console.log('Selecting IDE:', message.ideName);
						await config.update('selectedIDE', message.ideName, true);
						
						// 重新获取最新配置并更新WebView
						const selectUpdatedConfig = vscode.workspace.getConfiguration('editorjumper');
						configPanel.webview.html = getWebviewContent(selectUpdatedConfig.get('ideConfigurations'));
						updateStatusBar();
						break;
					case 'selectPath':
						const options = {
							canSelectFiles: true,
							canSelectFolders: false,
							canSelectMany: false,
							openLabel: 'Select',
							filters: {}
						};

						if (process.platform === 'darwin') {
							options.canSelectFiles = false;
							options.canSelectFolders = true;
						}

						const result = await vscode.window.showOpenDialog(options);
						if (result && result[0]) {
							let selectedPath = result[0].fsPath;
							
							if (process.platform === 'darwin') {
								const ideName = message.ideType.toLowerCase();
								selectedPath = `${selectedPath}/Contents/MacOS/${ideName}`;
							}
							
							configPanel.webview.postMessage({
								command: 'setPath',
								path: selectedPath
							});
						}
						break;
				}
			} catch (error) {
				console.error('Error handling message:', error);
				vscode.window.showErrorMessage('Error handling message: ' + error.message);
			}
		},
		undefined,
		context.subscriptions
	);

	configPanel.onDidDispose(
		() => {
			configPanel = undefined;
		},
		null,
		context.subscriptions
	);
}

function getWebviewContent(ideConfigurations) {
	const ideTypes = ["IDEA", "WebStorm", "PyCharm", "GoLand", "CLion", "PhpStorm", "RubyMine", "Rider"];
	const config = vscode.workspace.getConfiguration('editorjumper');
	const selectedIDE = config.get('selectedIDE');
	
	// 获取当前平台类型和对应的命令字段名
	const platform = process.platform;
	let commandField = '';
	let commandLabel = 'Command Path';
	
	if (platform === 'darwin') {
		commandField = 'macCommand';
		commandLabel = 'Application Path';
	} else if (platform === 'win32') {
		commandField = 'windowsCommand';
	} else {
		commandField = 'linuxCommand';
	}

	// 是否是macOS平台
	const isMac = platform === 'darwin';

	return `<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { padding: 20px; }
			.ide-list { margin: 20px 0; }
			.ide-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 10px;
				margin: 5px 0;
				border: 1px solid var(--vscode-input-border);
				border-radius: 4px;
			}
			.ide-info {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.ide-controls {
				display: flex;
				gap: 10px;
			}
			.selected-indicator {
				color: var(--vscode-terminal-ansiGreen);
			}
			.form-group {
				margin: 10px 0;
			}
			.form-group label {
				display: block;
				margin-bottom: 5px;
			}
			.form-group input[type="text"],
			.form-group select {
				width: 100%;
				padding: 5px;
			}
			.form-actions {
				margin-top: 20px;
				display: flex;
				gap: 10px;
			}
			.command-group {
				margin-top: 20px;
			}
			.custom-ide-group {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.action-buttons {
				margin-bottom: 20px;
			}
			button {
				padding: 4px 8px;
				cursor: pointer;
			}
			button:disabled {
				cursor: not-allowed;
				opacity: 0.6;
			}
			.hidden-ide {
				opacity: 0.6;
			}
			.checkbox-group {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.checkbox-group input[type="checkbox"] {
				margin: 0;
			}
			.note {
				margin-top: 5px;
				font-size: 0.9em;
				color: var(--vscode-descriptionForeground);
			}
			.highlight {
				background-color: var(--vscode-editor-selectionBackground);
				border-left: 3px solid var(--vscode-terminal-ansiGreen);
			}
		</style>
	</head>
	<body>
		<h2>EditorJumper Configurations</h2>
		<div class="action-buttons">
			<button onclick="showAddForm()">Add New IDE</button>
		</div>
		<div class="ide-list">
			${ideConfigurations.map(ide => `
				<div id="ide-${ide.name}" class="ide-item ${ide.hidden ? 'hidden-ide' : ''}">
					<div class="ide-info">
						${ide.name === selectedIDE ? '<span class="selected-indicator">✓</span>' : ''}
						<div>
							<strong>${ide.name}</strong>
							${ide.isCustom ? ' (Custom)' : ''}
						</div>
					</div>
					<div class="ide-controls">
						<div class="checkbox-group">
							<input type="checkbox" id="hidden-${ide.name}" 
								${ide.hidden ? 'checked' : ''} 
								onchange="toggleHidden('${ide.name}')">
							<label for="hidden-${ide.name}">Hidden</label>
						</div>
						<button onclick="editIDE('${ide.name}')">Edit</button>
						${ide.isCustom ? `
							<button onclick="removeIDE('${ide.name}')" 
								${ide.name === selectedIDE ? 'disabled title="Cannot remove currently selected IDE"' : ''}>
								Remove
							</button>
						` : ''}
						<button onclick="selectIDE('${ide.name}')">${ide.name === selectedIDE ? 'Selected' : 'Select'}</button>
					</div>
				</div>
			`).join('')}
		</div>

		<div id="ideForm" style="display: none; margin-top: 20px;">
			<h3 id="formTitle">Add New IDE</h3>
			<div class="form-group custom-ide-group">
				<input type="checkbox" id="isCustom" onchange="toggleCustomIDE()">
				<label for="isCustom">Custom IDE</label>
			</div>
			<div class="form-group">
				<label for="ideName">IDE Name:</label>
				<select id="ideName">
					${ideTypes.map(type => {
						const isDisabled = ideConfigurations.some(ide => !ide.isCustom && ide.name === type);
						return `<option value="${type}" ${isDisabled ? 'disabled' : ''}>${type}${isDisabled ? ' (Already exists)' : ''}</option>`;
					}).join('')}
				</select>
				<input type="text" id="customName" style="display: none;" placeholder="Enter IDE name">
			</div>
			<div class="form-group checkbox-group">
				<input type="checkbox" id="isHidden">
				<label for="isHidden">Hidden</label>
			</div>
			<div class="form-group command-group" id="commandGroup">
				<div style="flex: 1;">
					<label for="command">${commandLabel}:</label>
					<div style="display: flex; gap: 10px;">
						<input type="text" id="command" readonly>
						<button id="browseButton" onclick="selectPath()">Browse...</button>
					</div>
					${isMac ? `<div class="note">Note: On macOS, only custom IDEs need path configuration. Standard IDEs use default paths.</div>` : 
					`<div class="note">Note: If left empty, system default path will be used if available.</div>`}
				</div>
			</div>
			<div class="form-actions">
				<button onclick="saveIDE()">Save</button>
				<button onclick="cancelEdit()">Cancel</button>
			</div>
		</div>

		<script>
			let vscode;
			try {
				vscode = acquireVsCodeApi();
			} catch (error) {
				console.error('Failed to acquire VS Code API:', error);
				alert('Failed to initialize VS Code API. Please reload the window.');
			}
			const configurations = ${JSON.stringify(ideConfigurations)};
			const selectedIDE = '${selectedIDE}';
			const platform = '${platform}';
			const commandField = '${commandField}';
			const isMac = ${isMac};

			function showAddForm() {
				document.getElementById('formTitle').textContent = 'Add New IDE';
				document.getElementById('ideForm').style.display = 'block';
				document.getElementById('isCustom').checked = false;
				document.getElementById('isHidden').checked = false;
				toggleCustomIDE();
				document.getElementById('command').value = '';
			}

			function toggleCustomIDE() {
				const isCustom = document.getElementById('isCustom').checked === true;
				const nameSelect = document.getElementById('ideName');
				const customName = document.getElementById('customName');
				const commandGroup = document.getElementById('commandGroup');
				const browseButton = document.getElementById('browseButton');
				
				nameSelect.style.display = isCustom ? 'none' : 'block';
				customName.style.display = isCustom ? 'block' : 'none';
				
				// 在macOS上，只有自定义IDE才能配置路径
				if (isMac) {
					commandGroup.style.display = isCustom ? 'block' : 'none';
				}
				
				if (isCustom) {
					customName.value = '';
					document.getElementById('command').value = '';
				} else {
					const firstAvailableOption = Array.from(nameSelect.options).find(option => !option.disabled);
					if (firstAvailableOption) {
						nameSelect.value = firstAvailableOption.value;
					}
					
					// 在macOS上，非自定义IDE不需要配置路径
					if (isMac) {
						document.getElementById('command').value = '';
					}
				}
			}

			function editIDE(name) {
				const ide = configurations.find(i => i.name === name);
				if (!ide) return;

				document.getElementById('formTitle').textContent = 'Edit IDE';
				document.getElementById('ideForm').style.display = 'block';
				
				const nameSelect = document.getElementById('ideName');
				const customName = document.getElementById('customName');
				const isCustomCheckbox = document.getElementById('isCustom');
				const isHiddenCheckbox = document.getElementById('isHidden');
				const commandGroup = document.getElementById('commandGroup');
				
				isCustomCheckbox.checked = ide.isCustom === true;
				isHiddenCheckbox.checked = ide.hidden === true;
				nameSelect.style.display = ide.isCustom ? 'none' : 'block';
				customName.style.display = ide.isCustom ? 'block' : 'none';
				
				// 在macOS上，只有自定义IDE才能配置路径
				if (isMac) {
					commandGroup.style.display = ide.isCustom ? 'block' : 'none';
				}
				
				if (ide.isCustom) {
					customName.value = ide.name;
				} else {
					nameSelect.value = ide.name;
				}
				
				document.getElementById('command').value = ide[commandField] || '';
			}

			function saveIDE() {
				if (!vscode) {
					alert('VS Code API not initialized. Please reload the window.');
					return;
				}
				
				const isCustom = document.getElementById('isCustom').checked === true;
				const name = isCustom ? 
					document.getElementById('customName').value : 
					document.getElementById('ideName').value;
				let command = document.getElementById('command').value;
				const isHidden = document.getElementById('isHidden').checked === true;

				// 在macOS上，非自定义IDE不需要命令路径
				if (isMac && !isCustom) {
					command = '';
				} else if (!isCustom && !command) {
					// 非macOS平台上，非自定义IDE可以有空命令路径，将使用默认路径
				} else if (isCustom && !command) {
					alert('Please provide a command path');
					return;
				}

				if (!name) {
					alert('Please provide an IDE name');
					return;
				}

				if (isCustom && !name.trim()) {
					alert('Please enter an IDE name');
					return;
				}

				// 创建IDE对象，根据当前平台设置命令路径
				const ide = {
					name: name,
					isCustom: isCustom,
					hidden: isHidden
				};
				
				// 根据当前平台设置命令路径
				if (platform === 'darwin') {
					ide.macCommand = command;
				} else if (platform === 'win32') {
					ide.windowsCommand = command;
				} else {
					ide.linuxCommand = command;
				}

				vscode.postMessage({
					command: 'addIDE',
					ide
				});

				document.getElementById('ideForm').style.display = 'none';
			}

			function toggleHidden(name) {
				const ide = configurations.find(i => i.name === name);
				if (!ide) return;

				const isHidden = document.getElementById('hidden-' + name).checked === true;
				
				vscode.postMessage({
					command: 'updateIDE',
					ide: {
						...ide,
						hidden: isHidden
					}
				});
			}

			function cancelEdit() {
				document.getElementById('ideForm').style.display = 'none';
			}

			function removeIDE(name) {
				if (name === selectedIDE) {
					alert('Cannot remove currently selected IDE. Please select another IDE first');
					return;
				}
				
				if (confirm('Are you sure you want to remove this IDE configuration?')) {
					vscode.postMessage({
						command: 'removeIDE',
						ideName: name
					});
				}
			}

			function selectIDE(name) {
				vscode.postMessage({
					command: 'selectIDE',
					ideName: name
				});
			}

			function selectPath() {
				if (!vscode) {
					alert('VS Code API not initialized. Please reload the window.');
					return;
				}
				
				const isCustom = document.getElementById('isCustom').checked === true;
				const ideName = isCustom ? 
					document.getElementById('customName').value : 
					document.getElementById('ideName').value;
				
				vscode.postMessage({
					command: 'selectPath',
					ideType: ideName.toLowerCase()
				});
			}

			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'setPath':
						document.getElementById('command').value = message.path;
						break;
					case 'highlightIDE':
						const ideElement = document.getElementById('ide-' + message.ideName);
						if (ideElement) {
							ideElement.classList.add('highlight');
							ideElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
							setTimeout(() => {
								editIDE(message.ideName);
							}, 500);
						}
						break;
				}
			});
		</script>
	</body>
	</html>`;
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
