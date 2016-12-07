using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows.Forms;
using Components.Scripting;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// Executes an XML script.
	/// </summary>
	public class XmlScriptExecutor : ScriptExecutorBase
	{
		private SynchronizationContext m_scxSyncContext = null;

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the required dependencies.
		/// </summary>
		/// <param name="p_modMod">The mod for which the script is running.</param>
		/// <param name="p_gmdGameMode">The game mode currently being managed.</param>
		/// <param name="p_eifEnvironmentInfo">The application's envrionment info.</param>
		/// <param name="p_igpInstallers">The utility class to use to install the mod items.</param>
		/// <param name="p_scxUIContext">The <see cref="SynchronizationContext"/> to use to marshall UI interactions to the UI thread.</param>		
		public XmlScriptExecutor(SynchronizationContext p_scxUIContext)
		{
			m_scxSyncContext = p_scxUIContext;
		}

		#endregion
		
		#region ScriptExecutorBase Members

		/// <summary>
		/// Executes the script.
		/// </summary>
		/// <param name="p_scpScript">The XMl Script to execute.</param>
		/// <returns><c>true</c> if the script completes successfully;
		/// <c>false</c> otherwise.</returns>
		/// <exception cref="ArgumentException">Thrown if <paramref name="p_scpScript"/> is not an
		/// <see cref="XmlScript"/>.</exception>
		public override bool DoExecute(IScript p_scpScript)
		{
			if (!(p_scpScript is XmlScript))
				throw new ArgumentException("The given script must be of type XmlScript.", p_scpScript.Type.TypeName);

			XmlScript xscScript = (XmlScript)p_scpScript;

			ConditionStateManager csmStateManager = ((XmlScriptType)xscScript.Type).CreateConditionStateManager();
			if ((xscScript.ModPrerequisites != null) && !xscScript.ModPrerequisites.GetIsFulfilled(csmStateManager))
				throw new Exception(xscScript.ModPrerequisites.GetMessage(csmStateManager));

			IList<InstallStep> lstSteps = xscScript.InstallSteps;
			HeaderInfo hifHeaderInfo = xscScript.HeaderInfo;
			//if (String.IsNullOrEmpty(hifHeaderInfo.ImagePath))
			//	hifHeaderInfo.ImagePath = Mod.ScreenshotPath;
			if ((hifHeaderInfo.Height < 0) && hifHeaderInfo.ShowImage)
				hifHeaderInfo.Height = 75;
            // ??? Delegate
			//OptionsForm ofmOptions = null;
			//if (m_scxSyncContext == null)
			//	ofmOptions = new OptionsForm(xscScript, hifHeaderInfo, csmStateManager, lstSteps);
			//else
			//	m_scxSyncContext.Send(x => ofmOptions = new OptionsForm(xscScript, hifHeaderInfo, csmStateManager, lstSteps), null);
			//ofmOptions.Name = "OptionForm";
			//bool booPerformInstall = false;
			//if (lstSteps.Count == 0)
			//	booPerformInstall = true;
			//else
			//{
			//	if (m_scxSyncContext == null)
			//		booPerformInstall = (ofmOptions.ShowDialog() == DialogResult.OK);
			//	else
			//		m_scxSyncContext.Send(x => booPerformInstall = (ofmOptions.ShowDialog() == DialogResult.OK), null);
			//}

			//if (booPerformInstall)
			//{
			//	XmlScriptInstaller xsiInstaller = new XmlScriptInstaller(Mod, GameMode, Installers, m_ivaVirtualModActivator);
			//	OnTaskStarted(xsiInstaller);
			//	return xsiInstaller.Install(hifHeaderInfo.Title, xscScript, csmStateManager, ofmOptions.FilesToInstall, ofmOptions.PluginsToActivate);				
			//}
			return false;
		}

		#endregion
	}
}
