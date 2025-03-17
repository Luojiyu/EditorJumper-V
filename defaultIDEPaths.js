// 默认IDE路径配置
const fs = require('fs');
const os = require('os');

// 在macOS上查找IDE安装路径
function findMacAppPath(appNames) {
    const commonLocations = [
        '/Applications',
        `${os.homedir()}/Applications`
    ];

    // 只查找.app文件
    const appNamesWithExt = appNames.filter(name => name.endsWith('.app'));
    
    for (const location of commonLocations) {
        for (const appName of appNamesWithExt) {
            const fullPath = `${location}/${appName}`;
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }
    
    // 如果没有找到.app文件，返回null
    return null;
}

// 为每个IDE定义可能的应用程序名称
const ideAppNames = {
    'IDEA': ['IntelliJ IDEA Ultimate.app', 'IntelliJ IDEA.app', 'IntelliJ IDEA CE.app', 'IntelliJ IDEA Community Edition.app'],
    'WebStorm': ['WebStorm.app', 'webstorm'],
    'PyCharm': ['PyCharm Professional Edition.app', 'PyCharm.app', 'PyCharm CE.app', 'PyCharm Community Edition.app'],
    'GoLand': ['GoLand.app'],
    'CLion': ['CLion.app'],
    'PhpStorm': ['PhpStorm.app'],
    'RubyMine': ['RubyMine.app'],
    'Rider': ['Rider.app'],
    'Android Studio': ['Android Studio.app']
};

module.exports = {
    // 按IDE类型组织
    'IDEA': {
        darwin: findMacAppPath(ideAppNames['IDEA']),
        win32: 'idea',
        linux: 'idea'
    },
    'WebStorm': {
        darwin: findMacAppPath(ideAppNames['WebStorm']),
        win32: 'webstorm',
        linux: 'webstorm'
    },
    'PyCharm': {
        darwin: findMacAppPath(ideAppNames['PyCharm']),
        win32: 'pycharm',
        linux: 'pycharm'
    },
    'GoLand': {
        darwin: findMacAppPath(ideAppNames['GoLand']),
        win32: 'goland',
        linux: 'goland'
    },
    'CLion': {
        darwin: findMacAppPath(ideAppNames['CLion']),
        win32: 'clion',
        linux: 'clion'
    },
    'PhpStorm': {
        darwin: findMacAppPath(ideAppNames['PhpStorm']),
        win32: 'phpstorm',
        linux: 'phpstorm'
    },
    'RubyMine': {
        darwin: findMacAppPath(ideAppNames['RubyMine']),
        win32: 'rubymine',
        linux: 'rubymine'
    },
    'Rider': {
        darwin: findMacAppPath(ideAppNames['Rider']),
        win32: 'rider',
        linux: 'rider'
    },
    'Android Studio': {
        darwin: findMacAppPath(ideAppNames['Android Studio']),
        win32: 'studio',
        linux: 'studio'
    }
}; 