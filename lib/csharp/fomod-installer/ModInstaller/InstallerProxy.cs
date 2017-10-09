using FomodInstaller.Interface;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FomodInstaller.ModInstaller
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
            object[] stopPatterns = (object[])input.stopPatterns;
            object pluginPath = input.pluginPath;
            // this is actually the temporary path where the files requested in TestSupported
            // were put.
            string destinationPath = (string)input.scriptPath;
            var progressCB = (Func<object, Task<object>>)input.progressDelegate;
            CoreDelegates coreDelegates = new CoreDelegates(input.coreDelegates);
            return await mInstaller.Install(
                new List<string>(files.Cast<string>()),
                new List<string>(stopPatterns.Cast<string>()),
                (string)pluginPath,
                destinationPath,
                (int percent) => progressCB(percent),
                coreDelegates
            );
        }
    }
}
