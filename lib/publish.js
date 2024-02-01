const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const semver = require('semver');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const tools = require('./tools.js')
// 创建一个加载动画实例
const spinner = ora('Loading...\n');
const prompt = inquirer.createPromptModule();
const hostPackageJsonPath = path.resolve(process.cwd(), 'package.json');

// 退出
const exitSync = async (msg, promptFn = void 0) => {
    if (typeof promptFn === 'function') {
        !!msg && tools.warn(msg);
        await promptFn();
    } else {
        !!msg && tools.error(`进程终止（${msg}）`);
        process.exit(1);

    }
}

// 1、检测是否有登录态----------------------------------------------------
const checkLogin = async (options) => {
    const registry = options.registry || childProcess.execSync(`npm config get registry`).toString();
    const registryArg = registry ? `--registry ${registry}` : ''
    const loginInfo = childProcess.execSync(`npm whoami ${registryArg}`).toString();
    if (loginInfo) {
        tools.log('当前登录用户: ', loginInfo);
    } else {
        await exitSync(`未登录npm，请手动执行npm login`);
    }
};

// 2、分支要求----------------------------------------------------
const checkBranch = async (options) => {
    if (options.noGit) return Promise.resolve(true);
    const currentBranch = childProcess.execSync('git rev-parse --abbrev-ref -- HEAD').toString().trim();
    const answer = {};
    if (options.gitBranchTrust) {
        answer.confirmBranch = true;
    } else {
        answer.confirmBranch = await prompt([{ type: 'confirm', name: 'confirmBranch', default: 'Yes', choices: ['Yes', 'No'], message: `当前分支为 ${currentBranch} ,是否确认符合发版分支要求？` }]);
    }
    if (answer.confirmBranch) {
        try {
            childProcess.execSync('git diff-index --quiet HEAD --', { stdio: 'ignore' });
        } catch (err) {
            await exitSync('本地有未提交的代码', async () => {
                const answer = await prompt([{ type: 'confirm', name: 'confirmToAdd', default: 'Yes', choices: ['Yes', 'No'], message: '是否提交本地代码？' }]);
                if (answer.confirmToAdd) {
                    return Promise.resolve(true)
                } else {
                    return Promise.reject(false)
                }
            });
        }

        // 获取当前分支与远程分支的差异
        const diff = childProcess.execSync(`git diff ${currentBranch} origin/${currentBranch}`).toString();

        // 如果有差异，说明还有未提交的代码
        if (diff) {
            await exitSync('当前分支存在未提交远端的代码', async () => {
                const answer = await prompt([{ type: 'confirm', name: 'confirmToGitPush', default: 'Yes', choices: ['Yes', 'No'], message: '是否推送代码到远端仓库？' }]);
                if (answer.confirmToGitPush) {
                    return Promise.resolve(true)
                } else {
                    return Promise.reject(false)
                }
            });
        }
    } else {
        return Promise.reject(false)
    }

}

// 3、修改版本号----------------------------------------------------
const updateVersion = async (options) => {
    const packageJson = require(hostPackageJsonPath);
    const { version: currentVersion, name: currentPkgName } = packageJson;
    // 生成新的版本号
    // mode: "patch" | "major" | "premajor" | "minor" | "preminor" | "prepatch" | "prerelease" ；
    // tag: "default" | "latest" | "rc" | "alpha" | "beta" ；
    const newVersion = semver.inc(currentVersion, options.mode, options.tag, options.identifierBase);
    if (!semver.valid(newVersion)) {
        return exitSync(`版本号生成错误：${newVersion}`);
    }
    tools.log('new version：', chalk.blue.bold(`${newVersion}`))
    tools.info('loading...');
    // 更新package.json文件中的版本号
    packageJson.version = newVersion;
    // 改写package.json
    fs.writeFileSync(hostPackageJsonPath, JSON.stringify(packageJson, null, 2), { encoding: "utf8" });
    return { currentPkgName, newVersion, ...options };
}

// 4、发包----------------------------------------------------
const publishTgz = async ({ noGit, tag }, { currentPkgName, newVersion }) => {
    const gitSync = () => {
        childProcess.execSync(`git add . && git commit -m "chore: publish package ${currentPkgName}@${newVersion}" && git pull && git push`)
        tools.log(chalk.blue(`git 推送远端成功`));
    }
    if (!noGit) {
        gitSync();
    };
    childProcess.execSync(`npm publish`);
    tools.log('\x1b[1m%s\x1b[22m', 'Success to publish package ', chalk.green.bold.underline(`${currentPkgName}@${newVersion}`))
    // 打tag
    if (!['default', 'latest'].includes(tag) && tag) {
        childProcess.execSync(`npm dist-tag add ${currentPkgName}@${newVersion} ${tag}`);
    }
    tools.log('\x1b[1m%s\x1b[22m', 'Success to dist-tag package ', chalk.green.bold(`${tag}`))
}

const spinnerHandler = (index, content = '') => {
    return async () => spinner[(['start', 'stop', 'succeed'][index])](content);
}
const _execSync = childProcess.execSync;
const _semver_inc = semver.inc;
module.exports = (options) => {
    if (options.debug) {
        tools.debug('options:', options)
        childProcess.execSync = function (...args) {
            tools.debug('execSync args: ', args.join(','));
            return _execSync(...args);
        };
        semver.inc = function (...args) {
            tools.debug('semver.inc args: ', args.join(','));
            return _semver_inc(...args);
        }
    } else {
        tools.debug = () => void 0;
    }
    [spinnerHandler(0), checkLogin, spinnerHandler(1), checkBranch, updateVersion, publishTgz, spinnerHandler(2, '发布成功！')].reduce((pre, cur) => {
        return pre.then((res) => cur(options, res)).catch((err) => {
            tools.log(chalk.red(`\n发生错误:`));
            tools.log(chalk.red(err));
            process.exit(1);
            return new Promise(() => { })
        });
    }, Promise.resolve());
}