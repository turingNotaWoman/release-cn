const chalk = require('chalk');

module.exports = {
    log(...args) {
        return console.log.apply(console, args)
    },
    info(...args) {
        return console.info.apply(console, args)
    },
    debug(...args) {
        console.log.apply(console, [chalk.bgBlue('【debug message】'), ...args]);
    },
    warn(...args) {
        console.log.apply(console, [chalk.black.bgYellowBright(`【WARING】`), ...args]);
    },
    error(...args) {
        console.log.apply(console, [chalk.bgRed(`【ERROR】`), ...args]);
    }
}