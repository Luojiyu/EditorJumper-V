// 默认IDE路径配置
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

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

// 直接返回命令名称，不执行查找
module.exports = {
    'IDEA': {
        darwin: 'idea',
        win32: 'idea',
        linux: 'idea'
    },
    'WebStorm': {
        darwin: 'webstorm',
        win32: 'webstorm',
        linux: 'webstorm'
    },
    'PyCharm': {
        darwin: 'pycharm',
        win32: 'pycharm',
        linux: 'pycharm'
    },
    'GoLand': {
        darwin: 'goland',
        win32: 'goland',
        linux: 'goland'
    },
    'CLion': {
        darwin: 'clion',
        win32: 'clion',
        linux: 'clion'
    },
    'PhpStorm': {
        darwin: 'phpstorm',
        win32: 'phpstorm',
        linux: 'phpstorm'
    },
    'RubyMine': {
        darwin: 'rubymine',
        win32: 'rubymine',
        linux: 'rubymine'
    },
    'Rider': {
        darwin: 'rider',
        win32: 'rider',
        linux: 'rider'
    },
    'Android Studio': {
        darwin: 'studio',
        win32: 'studio',
        linux: 'studio'
    }
}; 