#!/usr/bin/env node
const path = require('path');
const inquirer = require('inquirer');
const { program, Option } = require('commander');
const packageJsonPath = path.resolve(__dirname, 'package.json');
const prompt = inquirer.createPromptModule();
const anntoRelease = require('./lib/publish');

const modeList = ["patch", "major", "premajor", "minor", "preminor", "prepatch", "prerelease"];
const modeObjectList = [{
    name: '--patch：修复 bug 或者进行一些小的改动，不会影响软件的主要功能，版本号的最后一位加 1；',
    value: 'patch',
}, {
    name: '--minor：添加新的功能或者进行一些小的改动，但是不会影响软件的主要功能，版本号的中间一位加 1，同时最后一位归零；',
    value: 'minor'
}, {
    name: '--major：进行了重大的改动或者添加了新的功能，可能会影响软件的主要功能，版本号的第一位加 1，同时中间和最后一位归零；',
    value: 'major'
}, {
    name: '--prepatch：在 patch 的基础上进行了一些测试，版本号的最后一位加 1，同时在最后一位添加一个预发布标识符；',
    value: 'prepatch'
}, {
    name: '--preminor：在 minor 的基础上进行了一些测试，版本号的中间一位加 1，同时最后一位归零，在最后一位添加一个预发布标识符；',
    value: 'preminor'
}, {
    name: '--premajor：在 major 的基础上进行了一些测试，版本号的第一位加 1，同时中间和最后一位归零，在最后一位添加一个预发布标识符；',
    value: 'premajor'
}, {
    name: '--prerelease：在发布正式版本之前，进行一些测试，可以在版本号的最后一位添加一个预发布标识符，例如 1.0.0-beta.1；',
    value: 'prerelease'
}];
const tagList = ["latest", "beta", "alpha", "rc"];
program
    .version(`${require(packageJsonPath).version} `, '-v, --version')
    .option('-r, --registry <url>', 'Use specified npm registry when installing dependencies (only for npm)')
    .option('-s, --slient', '开启静默模式', false)
    .option('-d, --debug', '开启debug模式', false)
    .option('-ngt --noGit', '忽略Git操作模式', false)
    .addOption(new Option('-m, --mode <modeType>', '发版模式', 'patch').choices([...modeList]))
    .addOption(new Option('-t, --tag <tagType>', 'npm版本Tag').choices([...tagList]))
    .addOption(new Option('-i, --identifierBase <number>', '测试小版本（-m 或者--mode为"premajor", "preminor", "prepatch", "prerelease"中的值才会有效）', false))
    .description('start service')
    .action(async (options) => {
        const defaultOption = {
            noGit: false,
            gitBranchTrust: false,
            debug: false,
            tag: 'latest',
            mode: 'patch',
            identifierBase: 0
        }
        // slient 模式开启
        if (options.slient) {
            options.mode = options.mode ?? 'patch';
            options.gitBranchTrust = options.gitBranchTrust ?? true;
        }
        // no-git模式
        if (options.noGit) {
            options.gitBranchTrust = true
        }
        // 未声明发版模式
        if (!options.mode) {
            const { confirmMode } = await prompt([{ type: 'list', name: 'confirmMode', default: modeObjectList[0].value, choices: [...modeObjectList], message: '请选择发版模式：' }]);
            options.mode = confirmMode;
        }
        // await validArgv(options);
        const assginOptions = Object.assign({}, defaultOption, options);
        anntoRelease(assginOptions);
    }).parse();