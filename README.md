# EditorJumper

<div align="center">
  <img src="image/png/pluginIcon.png" alt="EditorJumper Icon" width="128" height="128"/>
</div>

<div >
  <img src="https://img.shields.io/badge/VS%20Code-Extension-blue" alt="VS Code Extension"/>
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License"/>
  <a href="README_CN.md"><img src="https://img.shields.io/badge/文档-中文版-red.svg" alt="Chinese Doc"/></a>
</div>

## 🔍 Introduction

EditorJumper is a VS Code extension that allows you to seamlessly jump between modern code editors (VS Code, Cursor, Trae, Windsurf) and JetBrains IDEs (such as IntelliJ IDEA, WebStorm, PyCharm, etc.). It maintains your cursor position and editing context, greatly improving development efficiency in multi-editor environments.

## 🌟 Features

- 🚀 **Seamless Editor Switching**
  - Quickly jump from VS Code, Cursor, Trae, or Windsurf to JetBrains IDEs
  - Automatically positions to the same cursor location (line and column)
  - Perfectly maintains editing context without interrupting workflow

- 🎯 **Smart Jump Behavior**
  - With file open: Opens the same project and file in the target IDE, preserving cursor position
  - Without file open: Opens the project directly in the target IDE

- ⚡ **Multiple Trigger Methods**
  - Right-click in editor - select "Open in JetBrains IDE"
  - Right-click in file explorer - select "Open in JetBrains IDE"
  - Customizable keyboard shortcuts

- 🎚️ **Easy Target IDE Selection**
  - Status bar widget - click the IDE icon to select which JetBrains IDE to jump to

## 💻 System Requirements

- VS Code 1.60.0 or higher, or other supported editors (Cursor, Trae, Windsurf)
- Installed JetBrains IDE (IntelliJ IDEA, WebStorm, PyCharm, etc.)

## 📥 Installation

1. Open VS Code (or other supported editor)
2. Go to Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "EditorJumper"
4. Click the Install button

## ⚙️ Configuration

1. Open VS Code settings (Ctrl+, or Cmd+,)
2. Search for "EditorJumper"
3. Configure the following options:
   - Select default JetBrains IDE
   - Add or edit custom IDE configurations

You can also quickly access the configuration interface by clicking the settings icon (⚙️) in the status bar.

### Configuration Interface

The configuration interface allows you to:
- Add new IDE configurations
- Edit existing IDE configurations
- Hide unwanted IDEs
- Select the default IDE

For each IDE, you can configure:
- IDE name
- Command path (based on operating system)
- Whether to hide it in the selection list

## 🚀 Usage

### Via Right-Click Menu

1. Right-click in the editor or file explorer
2. Select "Open in JetBrains IDE"

### Via Status Bar

1. Click the IDE icon in the bottom status bar
2. Select the JetBrains IDE you want to jump to
3. Use any of the trigger methods above to perform the jump

## 🔄 Column Calculation

EditorJumper intelligently handles tab character width differences, ensuring cursor position accuracy when opening files in JetBrains IDEs.

## 🔄 Complementary Use

For a complete bidirectional workflow, it is recommended to use this extension together with [EditorJumper](https://github.com/wanniwa/EditorJumper), a JetBrains IDE plugin that allows you to jump back from JetBrains IDEs to VS Code, Cursor, Trae, or Windsurf. Using both tools together creates a seamless development experience across all your favorite editors.

## 🤝 Contribution

Pull Requests and Issues are welcome to help improve this plugin!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
