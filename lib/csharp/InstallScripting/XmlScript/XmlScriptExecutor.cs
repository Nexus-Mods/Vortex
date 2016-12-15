using System;
using System.Collections.Generic;
using System.Threading;
using Components.Interface;
using Components.Scripting;

namespace Components.Scripting.XmlScript
{
	/// <summary>
	/// Executes an XML script.
	/// </summary>
	public class XmlScriptExecutor : ScriptExecutorBase
	{
		private SynchronizationContext m_scxSyncContext = null;
        private Mod ModArchive = null;
        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the required dependencies.
        /// </summary>
        /// <param name="modArchive">The mod object containing the file list in the mod archive.</param>
        /// <param name="UserInteractionDelegate">The utility class to use to install the mod items.</param>
        /// <param name="scxUIContext">The <see cref="SynchronizationContext"/> to use to marshall UI interactions to the UI thread.</param>		
        public XmlScriptExecutor(Mod modArchive, string UserInteractionDelegate, SynchronizationContext scxUIContext)
		{
            ModArchive = modArchive;
			m_scxSyncContext = scxUIContext;
		}

        #endregion

        #region ScriptExecutorBase Members

        /// <summary>
        /// Executes the script.
        /// </summary>
        /// <param name="scpScript">The XMl Script to execute.</param>
        /// <returns><c>true</c> if the script completes successfully;
        /// <c>false</c> otherwise.</returns>
        /// <exception cref="ArgumentException">Thrown if <paramref name="scpScript"/> is not an
        /// <see cref="XmlScript"/>.</exception>
        public override bool DoExecute(IScript scpScript)
		{
            List<InstallableFile> FilesToInstall = new List<InstallableFile>();
            List<InstallableFile> PluginsToActivate = new List<InstallableFile>();
            
            if (!(scpScript is XmlScript))
				throw new ArgumentException("The given script must be of type XmlScript.", scpScript.Type.TypeName);

			XmlScript xscScript = (XmlScript)scpScript;

			ConditionStateManager csmStateManager = ((XmlScriptType)xscScript.Type).CreateConditionStateManager();
			if ((xscScript.ModPrerequisites != null) && !xscScript.ModPrerequisites.GetIsFulfilled(csmStateManager))
				throw new Exception(xscScript.ModPrerequisites.GetMessage(csmStateManager));

			IList<InstallStep> lstSteps = xscScript.InstallSteps;
			HeaderInfo hifHeaderInfo = xscScript.HeaderInfo;
            if (string.IsNullOrEmpty(hifHeaderInfo.ImagePath))
                hifHeaderInfo.ImagePath = ModArchive.ScreenshotPath;
            if ((hifHeaderInfo.Height < 0) && hifHeaderInfo.ShowImage)
				hifHeaderInfo.Height = 75;
            // ??? UserInteractionDelegate
            //OptionsForm ofmOptions = null;
            //if (m_scxSyncContext == null)
            //	ofmOptions = new OptionsForm(xscScript, hifHeaderInfo, csmStateManager, lstSteps);
            //else
            //	m_scxSyncContext.Send(x => ofmOptions = new OptionsForm(xscScript, hifHeaderInfo, csmStateManager, lstSteps), null);
            //ofmOptions.Name = "OptionForm";
            bool booPerformInstall = false;
            if (lstSteps.Count == 0)
                booPerformInstall = true;
            else
            {
                //if (m_scxSyncContext == null)
                //    booPerformInstall = (ofmOptions.ShowDialog() == DialogResult.OK);
                //else
                //    m_scxSyncContext.Send(x => booPerformInstall = (ofmOptions.ShowDialog() == DialogResult.OK), null);
            }

            if (booPerformInstall)
            {
                XmlScriptInstaller xsiInstaller = new XmlScriptInstaller(ModArchive);
                // ??? OnTaskStarted(xsiInstaller);
                return xsiInstaller.Install(xscScript, csmStateManager, FilesToInstall, PluginsToActivate);
            }
            return false;
		}

		#endregion
	}
}
