using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using FomodInstaller.Extensions;
using FomodInstaller.Scripting;
using System.Text;

namespace FomodInstaller.ModInstaller
{
    [Serializable]
    public class UnsupportedException : Exception
    {
        public UnsupportedException()
        { }
    }

    public class ModFormatManager
    {

        #region Fields

        private static string FomodRoot = "fomod";
        private static string OmodRoot = "omod";
        private static ISet<string> RequiredExtensions = new HashSet<string> { ".gif", ".ico", ".jpeg", ".jpg", ".png", ".txt", ".xml", ".xsd" };
        #endregion

        #region Properties

        public IScriptTypeRegistry CurrentScriptTypeRegistry;

        #endregion

        #region Costructors

        public ModFormatManager()
        {
            // ??? Dummy path
        }

        #endregion

        public async Task<IList<string>> GetRequirements(IList<string> modFiles, bool includeAssets)
        {
            CurrentScriptTypeRegistry = await ScriptTypeRegistry.DiscoverScriptTypes(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location));
            // TODO: I don't think there is a good way to determine which image files are referenced by the installer script without
            //   unpacking it first, right?
            IList<string> RequiredFiles = includeAssets
                ? modFiles.Where(path => RequiredExtensions.Contains(Path.GetExtension(path))).ToList()
                : new List<string>();

            return await Task.Run(() =>
            {
                bool HasFoundScriptType = false;
                foreach (IScriptType scriptType in CurrentScriptTypeRegistry.Types)
                {
                    if (scriptType.FileNames != null)
                    {
                        foreach (string scriptFile in scriptType.FileNames)
                        {
                            // ??? Need to check for Fomod/Omod/Whatever before this part
                            string FileToFind = Path.Combine(FomodRoot, scriptFile);
                            string Match = modFiles.Where(x => Path.GetFileName(x).Contains(scriptFile, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(Path.GetDirectoryName(x)).Contains(FomodRoot, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
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

                if (!HasFoundScriptType)
                {
                    throw new UnsupportedException();
                }

                return RequiredFiles;
            });
        }

        public async Task<IScriptType> GetScriptType(IList<string> modFiles)
        {
            CurrentScriptTypeRegistry = await ScriptTypeRegistry.DiscoverScriptTypes(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location));
            IScriptType FoundScriptType = null;

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
                            string Match = modFiles.Where(x => Path.GetFileName(x).Contains(scriptFile, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(Path.GetDirectoryName(x)).Contains(FomodRoot, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                            if (!string.IsNullOrEmpty(Match))
                            {
                                HasFoundScriptType = true;
                                FoundScriptType = scriptType;
                            }
                        }
                    }

                    if (HasFoundScriptType)
                        break;
                }
            });

            return FoundScriptType;
        }
    }
}
