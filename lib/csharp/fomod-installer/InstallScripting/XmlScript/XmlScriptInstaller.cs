using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Xml.Linq;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
    /// <summary>
    /// Performs the mod installation based on the XML script.
    /// </summary>
    public class XmlScriptInstaller // ??? : BackgroundTask
    {
        private List<Instruction> modInstallInstructions = new List<Instruction>();

        #region Properties

        private Mod ModArchive;

        #endregion

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the required dependencies.
        /// </summary>
        /// <param name="modArchive">The mod for which the script is running.</param>
        public XmlScriptInstaller(Mod modArchive)
        {
            ModArchive = modArchive;
        }

        #endregion

        /// <summary>
        /// Performs the mod installation based on the XML script.
        /// </summary>
        /// <param name="xscScript">The script that is executing.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <param name="filesToInstall">The list of files to install.</param>
        /// <param name="pluginsToActivate">The list of plugins to activate.</param>
        /// <returns><c>true</c> if the installation succeeded;
        /// <c>false</c> otherwise.</returns>
        public IList<Instruction> Install(XmlScript xscScript, ConditionStateManager csmState, CoreDelegates coreDelegates, IEnumerable<InstallableFile> filesToInstall, ICollection<InstallableFile> pluginsToActivate)
        {
            try
            {
                InstallFiles(xscScript, csmState, coreDelegates, filesToInstall, pluginsToActivate);
            }
            catch (Exception ex)
            {
                modInstallInstructions.Add(Instruction.InstallError(ex.Message));
            }
            return modInstallInstructions;
        }

        /// <summary>
        /// Installs and activates files are required. This method is used by the background worker.
        /// </summary>
        /// <param name="xscScript">The script that is executing.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <param name="filesToInstall">The list of files to install.</param>
        /// <param name="pluginsToActivate">The list of plugins to activate.</param>
        protected bool InstallFiles(XmlScript xscScript, ConditionStateManager csmState, CoreDelegates coreDelegates, IEnumerable<InstallableFile> filesToInstall, ICollection<InstallableFile> pluginsToActivate)
        {
            bool HadIssues = false;
            IList<InstallableFile> lstRequiredFiles = xscScript.RequiredInstallFiles;
            IList<ConditionallyInstalledFileSet> lstConditionallyInstalledFileSets = xscScript.ConditionallyInstalledFileSets;

            foreach (InstallableFile iflRequiredFile in lstRequiredFiles)
            {
                if (!InstallFile(iflRequiredFile))
                    HadIssues = true;
            }

            if (!HadIssues)
            {
                foreach (InstallableFile ilfFile in filesToInstall)
                {
                    if (!InstallFile(ilfFile)) // ??? , pluginsToActivate.Contains(ilfFile)))
                        HadIssues = true;
                }
            }

            if (!HadIssues)
            {
                foreach (ConditionallyInstalledFileSet cisFileSet in lstConditionallyInstalledFileSets)
                {
                    if (cisFileSet.Condition.GetIsFulfilled(csmState, coreDelegates))
                        foreach (InstallableFile ilfFile in cisFileSet.Files)
                        {
                            if (!InstallFile(ilfFile))
                                HadIssues = true;
                        }
                }
            }

            if (!HadIssues)
                modInstallInstructions.Add(Instruction.EnableAllPlugins());

            return !HadIssues;
        }

        /// <summary>
        /// Installs the given <see cref="InstallableFile"/>, and activates any
        /// plugins it encompasses as requested.
        /// </summary>
        /// <param name="p_ilfFile">The file to install.</param>
        /// <returns><c>false</c> if the user cancelled the install;
        /// <c>true</c> otherwise.</returns>
        protected bool InstallFile(InstallableFile installableFile)
        {
            if (installableFile.IsFolder)
            {
                if (!InstallFolderFromMod(installableFile, ModArchive.Prefix))
                    return false;
            }
            else
            {
                string strSource = Path.Combine(ModArchive.Prefix, installableFile.Source);
                string strDest = installableFile.Destination;
                InstallFileFromMod(strSource, strDest);

                /// ??? Plugin activation
            }

            return true;
        }

        #region Helper Methods

        /// <summary>
        /// Recursively copies all files and folders from one location to another.
        /// </summary>
        /// <param name="installableFile">The folder to install.</param>
        /// <returns><c>false</c> if the user cancelled the install;
        /// <c>true</c> otherwise.</returns>
        protected bool InstallFolderFromMod(InstallableFile installableFile, string strPrefixPath)
        {
            List<string> lstModFiles = ModArchive.GetFileList(Path.Combine(strPrefixPath, installableFile.Source), true);

            string strFrom = Path.Combine(strPrefixPath, installableFile.Source).Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            if (!strFrom.EndsWith(Path.DirectorySeparatorChar.ToString()))
                strFrom += Path.DirectorySeparatorChar;
            string strTo = installableFile.Destination.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            if ((strTo.Length > 0) && (!strTo.EndsWith(Path.DirectorySeparatorChar.ToString())))
                strTo += Path.DirectorySeparatorChar;
            string strMODFile = null;
            for (int i = 0; i < lstModFiles.Count; i++)
            {
                strMODFile = lstModFiles[i];
                string strNewFileName = strMODFile.Substring(strFrom.Length, strMODFile.Length - strFrom.Length);
                if (strTo.Length > 0)
                    strNewFileName = Path.Combine(strTo, strNewFileName);
                InstallFileFromMod(strMODFile, strNewFileName);
            }
            return true;
        }

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <param name="fromPath">The path of the file in the mod to install.</param>
        /// <param name="toPath">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        protected bool InstallFileFromMod(string fromPath, string toPath)
        {
            bool booSuccess = false;

            if (toPath.EndsWith("" + Path.AltDirectorySeparatorChar)
                || toPath.EndsWith("" + Path.DirectorySeparatorChar))
            {
                modInstallInstructions.Add(Instruction.CreateMKDir(toPath));

            } else
            {
                modInstallInstructions.Add(Instruction.CreateCopy(fromPath, toPath));
            }

            booSuccess = true;

            return booSuccess;
        }

        #endregion
    }
}
