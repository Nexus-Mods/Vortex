using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Components.ModInstaller
{
    public class InstallerProxy
    {
        private Installer mInstaller;

        public InstallerProxy()
        {
            mInstaller = new Installer();
        }

        public async Task<object> TestSupported(dynamic input)
        {
            try
            {
                object[] files = (object[])input.files;
                return await mInstaller.TestSupported(new List<string>(files.Cast<string>()));
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                throw e;
            }
        }

        public async Task<object> Install(dynamic input)
        {
            object[] files = (object[])input.files;
            string destinationPath = (string)input.destinationPath;
            var progressCB = (Func<object, Task<object>>)input.progressDelegate;
            var coreDelegates = (Core)input.coreDelegates;
            return await mInstaller.Install(
                new List<string>(files.Cast<string>()),
                destinationPath,
                (int percent) => progressCB(percent),
                coreDelegates
            );
        }
    }
}
