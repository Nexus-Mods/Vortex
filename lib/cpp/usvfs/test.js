const usvfs = require('.');

console.log('pid', process.pid);

setTimeout(() => {
  usvfs.createVFS({
    instanceName: 'test-vfs',
    debugMode: false,
    logLevel: 1,
    crashDumpType: 1,
    crashDumpPath: 'c:\\temp\\usvfs_crash.dmp',
  });

  console.log('vfs created');

  usvfs.linkDirectory('c:\\projects',
                      'c:\\Work\\NMM2\\lib\\cpp\\usvfs\\projects',
                      {recursive: true});

  usvfs.linkFile('c:\\Work\\NMM2\\lib\\cpp\\usvfs\\package.json',
                 'c:\\Work\\NMM2\\lib\\cpp\\usvfs\\dummy.json', {});

  console.log('links created');

  usvfs.spawn('cmd.exe' ['/C', 'dir', 'projects'], {});

  setTimeout(() => { console.log('done'); }, 2000);
}, 10000);
