using System;
using System.Text;
using System.Windows.Forms;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Runs a Mod Script script.
	/// </summary>
	/// <remarks>
	/// This class is meant to be run in a sandboxed domain in order to limit the possible
	/// damage from malicious or poorly written code.
	/// </remarks>
	public class ScriptRunner : MarshalByRefObject
	{
		private ModScriptFunctionProxy m_msfFunctions = null;

		#region Constructors
		
		/// <summary>
		/// A simple construtor that initializes the object with the given dependencies.
		/// </summary>
		/// <param name="p_msfFunctions">The object that implements the script functions.</param>
		public ScriptRunner(ModScriptFunctionProxy p_msfFunctions)
		{
			m_msfFunctions = p_msfFunctions;
		}

		#endregion

		/// <summary>
		/// Executes the given script.
		/// </summary>
		/// <param name="p_strScript">The script code to execute.</param>
		/// <returns><c>true</c> if the script completes successfully;
		/// <c>false</c> otherwise.</returns>
		public bool Execute(string p_strScript)
		{
			Application.EnableVisualStyles();
			Application.SetCompatibleTextRenderingDefault(false);
			Control.CheckForIllegalCrossThreadCalls = false;

			try
			{
				ModScriptInterpreter msiInterpreter = new ModScriptInterpreter(m_msfFunctions, p_strScript);
				return msiInterpreter.Execute();
			}
			catch (Exception ex)
			{
				StringBuilder stbException = new StringBuilder(ex.ToString());
				while (ex.InnerException != null)
				{
					ex = ex.InnerException;
					stbException.AppendLine().AppendLine().Append(ex.ToString());
				}
				string strMessage = "An exception occured in the script.";
				//m_msfFunctions.ExtendedMessageBox(strMessage, "Error", stbException.ToString(), MessageBoxButtons.OK, MessageBoxIcon.Error);
				return false;
			}
		}
	}
}
