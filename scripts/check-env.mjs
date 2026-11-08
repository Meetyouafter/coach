import {configurationErrors} from '../server/config.js';

const errors = configurationErrors();
errors.forEach(error => console.error(error));
if (errors.length) process.exitCode = 1;
