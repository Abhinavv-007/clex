#!/usr/bin/env node
/**
 * clex — send, fetch and manage Clex transfers from the terminal.
 *
 * No runtime dependencies: everything here is Node 20 standard library.
 */
import { parseArgs } from 'node:util'

import {
  cmdGet,
  cmdList,
  cmdLogin,
  cmdLogout,
  cmdRemove,
  cmdSend,
  cmdWhoami,
} from '../src/commands.js'
import { bold, cyan, dim, red } from '../src/format.js'

const VERSION = '0.1.0'

const HELP = `${bold('clex')} ${dim(VERSION)} — move files from the terminal

${bold('USAGE')}
  clex <command> [options]

${bold('COMMANDS')}
  send <file…>        Upload files and print a share link
  get <token|url>     Download a shared file
  ls                  List your active uploads
  rm <id…>            Revoke an upload
  login               Store an API key for this machine
  logout              Forget the stored API key
  whoami              Show which key is in use and whether it works

${bold('OPTIONS')}
  -e, --expires <dur> Lifetime for an upload: 30m, 12h, 7d  ${dim('(default 24h, max 7d)')}
  -o, --output <path> Where ${bold('get')} should write        ${dim('(default: the original name)')}
      --key <key>     Use this API key for one command
      --api <url>     Point at a different API base
      --json          Machine-readable output
  -q, --quiet         Print only the essential line
  -h, --help          Show this help
  -v, --version       Show the version

${bold('AUTHENTICATION')}
  Create a key at ${cyan('https://clex.in/developers')}, then either

    clex login                    ${dim('store it in ~/.config/clex/config.json (0600)')}
    export CLEX_API_KEY=clex_…    ${dim('use it for this shell / in CI')}

${bold('EXAMPLES')}
  clex send report.pdf
  clex send *.png --expires 1h
  clex send build.tgz --quiet | pbcopy      ${dim('# just the link')}
  clex get 4A3FSQ -o ./downloaded.pdf
  clex get https://clex.in/share/4A3FSQ
  clex ls --json | jq '.[].filename'
  clex rm up_1a2b3c
`

const OPTIONS = {
  expires: { type: 'string', short: 'e' },
  output: { type: 'string', short: 'o' },
  key: { type: 'string' },
  api: { type: 'string' },
  json: { type: 'boolean', default: false },
  quiet: { type: 'boolean', short: 'q', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
}

async function main(argv) {
  let parsed
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true })
  } catch (err) {
    process.stderr.write(`${red(err.message)}\n\nRun ${bold('clex --help')}.\n`)
    return 2
  }

  const { values: flags, positionals } = parsed
  const [command, ...rest] = positionals

  if (flags.version) {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }
  if (flags.help || !command) {
    process.stdout.write(`${HELP}\n`)
    return command ? 0 : (flags.help ? 0 : 1)
  }

  switch (command) {
    case 'send':
    case 'up':
    case 'upload':
      return cmdSend(rest, flags)

    case 'get':
    case 'down':
    case 'download':
      return cmdGet(rest[0], flags)

    case 'ls':
    case 'list':
      return cmdList(flags)

    case 'rm':
    case 'delete':
    case 'revoke':
      return cmdRemove(rest, flags)

    case 'login':
      return cmdLogin(flags)

    case 'logout':
      return cmdLogout()

    case 'whoami':
    case 'status':
      return cmdWhoami(flags)

    case 'help':
      process.stdout.write(`${HELP}\n`)
      return 0

    default:
      process.stderr.write(
        `${red(`Unknown command "${command}".`)}\n\nRun ${bold('clex --help')} to see what's available.\n`,
      )
      return 2
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code ?? 0
  })
  .catch((err) => {
    process.stderr.write(`${red('Unexpected error:')} ${err?.stack || err}\n`)
    process.exitCode = 1
  })
