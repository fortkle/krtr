// electron-builder afterPack hook.
// Without a Developer ID certificate electron-builder skips signing entirely,
// leaving the bundle with only a linker-signed main binary whose identifier is
// "Electron". macOS TCC then fails to associate the Screen Recording grant
// with the app, so captures silently return empty images. Ad-hoc signing the
// whole bundle with the proper bundle-id identifier fixes that (the grant
// still resets on each rebuild — only a real certificate avoids that).
const { spawnSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )

  // codesign -dvv prints signature details to stderr
  const check = spawnSync('codesign', ['-dvv', appPath], { encoding: 'utf8' })
  if (check.stderr && check.stderr.includes('Authority=')) {
    // Properly signed with a certificate — leave it alone
    return
  }

  const sign = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  if (sign.status !== 0) {
    throw new Error(`ad-hoc codesign failed for ${appPath}`)
  }
  console.log(`  • ad-hoc signed ${appPath}`)
}
