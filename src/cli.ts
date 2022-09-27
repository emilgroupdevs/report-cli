#!/usr/bin/env node

import * as yargs from 'yargs';
import JsonCommand from './command/json.command';

yargs
  .usage('Usage: $0 <command> [options]')
  .command(new JsonCommand())
  .recommendCommands()
  .demandCommand(1)
  .help('h')
  .alias('h', 'help')
  .argv;

require('yargonaut')
  .style('blue')
  .style('yellow', 'required')
  .helpStyle('green')
  .errorsStyle('red');
