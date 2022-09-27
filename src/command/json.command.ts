/* eslint-disable class-methods-use-this */

import * as yargs from 'yargs';
import { Argv } from 'yargs';
import dayjs from 'dayjs';
import { execute } from '../helper';
import fs from 'fs';

export default class JsonCommand implements yargs.CommandModule {
  command = 'json';

  describe = 'Generate report in json format';

  static builder(args: yargs.Argv): Argv['option'] {
    console.log(args)
    return args.option('date', {
      string: true,
      alias: 'd',
      desc: 'Set report date in format: YYYY-MM-DD',
      requiresArg: true
    });
  }

  async handler(args: yargs.Arguments): Promise<void> {
    try {
      let date = dayjs().toDate();
      console.log(args)

      if (args.d) {
        date = dayjs(args.d as string).toDate();
      }

      const data = await execute(date);
      console.log(data)

      fs.writeFileSync('report.json', JSON.stringify(data));
    } catch (err) {
      console.error('Error during tenant migration run:');
      console.error(err);
      process.exit(1);
    }
  }
}
