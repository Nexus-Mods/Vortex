using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security;
using System.Security.Permissions;
using System.Security.Policy;
using System.Threading.Tasks;
using System.Windows.Forms;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Executes a Mod Script script.
	/// </summary>
	public class ModScriptExecutor : ScriptExecutorBase
	{
		private ModScriptFunctionProxy m_msfFunctions = null;
		private string m_strVirtualActivatorPath = String.Empty;

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_msfFunctions">The proxy providing the implementations of the functions available to the mod script script.</param>
		public ModScriptExecutor(ModScriptFunctionProxy p_msfFunctions)
		{
			m_msfFunctions = p_msfFunctions;
		}

		#endregion

		#region ScriptExecutorBase Members

		/// <summary>
		/// Executes the script.
		/// </summary>
		/// <param name="p_scpScript">The Mod Script to execute.</param>
    /// <param name="p_strDataPath">path where script data is stored.</param>
		/// <returns><c>true</c> if the script completes successfully;
		/// <c>false</c> otherwise.</returns>
		/// <exception cref="ArgumentException">Thrown if <paramref name="p_scpScript"/> is not a
		/// <see cref="ModScript"/>.</exception>
		public override Task<IList<Instruction>> DoExecute(IScript p_scpScript, string p_strDataPath)
		{
			if (!(p_scpScript is ModScript))
				throw new ArgumentException("The given script must be of type ModScript.", "p_scpScript");

			ModScript mscScript = (ModScript)p_scpScript;

			if (string.IsNullOrEmpty(mscScript.Code))
				return null;

			AppDomain admScript = CreateSandbox(p_scpScript, p_strDataPath);
			try
			{
				object[] args = { m_msfFunctions };
				AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(CurrentDomain_AssemblyResolve);
				ScriptRunner srnRunner = null;
				try
				{
					srnRunner = (ScriptRunner)admScript.CreateInstanceFromAndUnwrap(typeof(ScriptRunner).Assembly.ManifestModule.FullyQualifiedName, typeof(ScriptRunner).FullName, false, BindingFlags.Default, null, args, null, null);
				}
				finally
				{
					AppDomain.CurrentDomain.AssemblyResolve -= CurrentDomain_AssemblyResolve;
				}
                return null; // ??? This requires tweaking: Task.Run(() => srnRunner.Execute(mscScript.Code));
			}
			finally
			{
				AppDomain.Unload(admScript);
			}
		}

		#endregion

		/// <summary>
		/// Handles the <see cref="AppDomain.AssemblyResolve"/> event.
		/// </summary>
		/// <remarks>
		/// Assemblies that have been load dynamically aren't accessible by assembly name. So, when, for example,
		/// this class looks for the assembly containing the ScriptRunner type that was CreateInstanceFromAndUnwrap-ed,
		/// the class can't find the type. This handler searches through loaded assemblies and finds the required assembly.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="args">A <see cref="ResolveEventArgs"/> describing the event arguments.</param>
		/// <returns>The assembly being looked for, or <c>null</c> if the assembly cannot
		/// be found.</returns>
		private Assembly CurrentDomain_AssemblyResolve(object sender, ResolveEventArgs args)
		{
			foreach (Assembly asmLoaded in AppDomain.CurrentDomain.GetAssemblies())
				if (asmLoaded.FullName == args.Name)
					return asmLoaded;
			return null;
		}

		/// <summary>
		/// Creates a sandboxed domain.
		/// </summary>
		/// <remarks>
		/// The sandboxed domain is only given permission to alter the parts of the system
		/// that are relevant to mod management for the current game mode.
		/// </remarks>
		/// <param name="p_scpScript">The script we are going to execute. This is required so we can include
		/// the folder containing the script's script type class in the sandboxes PrivateBinPath.
		/// We need to do this so that any helper classes and libraries used by the script
		/// can be found.</param>
    /// <param name="p_strDataPath">path where script data is stored. unused?</param>
		/// <returns>A sandboxed domain.</returns>
		protected AppDomain CreateSandbox(IScript p_scpScript, string p_strDataPath)
		{
			Trace.TraceInformation("Creating Mod Script Sandbox...");
			Trace.Indent();

			Evidence eviSecurityInfo = null;
			AppDomainSetup adsInfo = new AppDomainSetup();
			//should this be different from the current ApplicationBase?
			adsInfo.ApplicationBase = Path.GetDirectoryName(Application.ExecutablePath);


			Trace.TraceInformation("ApplicationBase: {0}", adsInfo.ApplicationBase);
			Trace.TraceInformation("PrivateBinPath: {0}", adsInfo.PrivateBinPath);

			adsInfo.ApplicationName = "ModScriptRunner";
			adsInfo.DisallowBindingRedirects = true;
			adsInfo.DisallowCodeDownload = true;
			adsInfo.DisallowPublisherPolicy = true;
			PermissionSet pstGrantSet = new PermissionSet(PermissionState.None);

			return AppDomain.CreateDomain("ModScriptRunnerDomain", eviSecurityInfo, adsInfo, pstGrantSet);
		}
	}
}
