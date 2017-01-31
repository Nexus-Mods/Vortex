using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Components.Scripting;

namespace Components.ModInstaller
{
    public class ModFormatManager
    {

        #region Fields

        private string FomodRoot = "fomod";
        private string OmodRoot = "omod";
        #endregion

        #region Properties

        protected IScriptTypeRegistry CurrentScriptTypeRegistry;

        #endregion

        #region Costructors

        public ModFormatManager()
        {
            // ??? Dummy path
            CurrentScriptTypeRegistry = ScriptTypeRegistry.DiscoverScriptTypes(".", new Utils.FileSystem());
        }

        #endregion

        public async Task<IList<string>> GetRequirements(IList<string> modFiles)
        {
            IList<string> RequiredFiles = new List<string>();

            await Task.Run(() =>
            {
                foreach (IScriptType scriptType in CurrentScriptTypeRegistry.Types)
                {
                    bool HasFoundScriptType = false;
                    if (scriptType.FileNames != null)
                    {
                        foreach (string scriptFile in scriptType.FileNames)
                        {
                            // ??? Need to check for Fomod/Omod/Whatever before this part
                            string FileToFind = Path.Combine(FomodRoot, scriptFile);
                            string Match = modFiles.FirstOrDefault(x => x.Contains(FileToFind));
                            if (!string.IsNullOrEmpty(Match))
                            {
                                HasFoundScriptType = true;
                                RequiredFiles.Add(Match);
                            }
                        }
                    }

                    if (HasFoundScriptType)
                        break;
                }
            });

            return RequiredFiles;
        }
    }
}
