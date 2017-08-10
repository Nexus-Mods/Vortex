using System;
using System.Collections.Generic;
using System.Threading;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Describes the Mod Script script type.
	/// </summary>
	/// <remarks>
	/// This is the script that allows scripting using the custom Mod Script language. It is meant
	/// to be a siple scripting language.
	/// </remarks>
	public class ModScriptType : IScriptType
	{
		private static List<string> m_lstFileNames = new List<string>() { "script", "script.txt" };

		#region IScriptType Members

		/// <summary>
		/// Gets the name of the script type.
		/// </summary>
		/// <value>The name of the script type.</value>
		public string TypeName
		{
			get
			{
				return "Mod Script";
			}
		}

		/// <summary>
		/// Gets the unique id of the script type.
		/// </summary>
		/// <value>The unique id of the script type.</value>
		public string TypeId
		{
			get
			{
				return "ModScript";
			}
		}

		/// <summary>
		/// Gets the list of file names used by scripts of the current type.
		/// </summary>
		/// <remarks>
		/// The list is in order of preference, with the first item being the preferred
		/// file name.
		/// </remarks>
		/// <value>The list of file names used by scripts of the current type.</value>
		public IList<string> FileNames
		{
			get
			{
				return m_lstFileNames;
			}
		}

        /// <summary>
        /// Creates an executor that can run the script type.
        /// </summary>
        /// <param name="modArchive">The mod being installed.</param>
        /// <param name="delegates">A delegate for all the interactions with the js core.</param>
        /// <returns>An executor that can run the script type.</returns>
        public IScriptExecutor CreateExecutor(Mod modArchive, CoreDelegates delegates)
		{
			ModScriptFunctionProxy msfFunctions = GetScriptFunctionProxy(modArchive, delegates);
			return new ModScriptExecutor(msfFunctions);
		}

		/// <summary>
		/// Loads the script from the given text representation.
		/// </summary>
		/// <param name="p_strScriptData">The text to convert into a script.</param>
		/// <returns>The <see cref="IScript"/> represented by the given data.</returns>
		public IScript LoadScript(string p_strScriptData)
		{
			return new ModScript(this, p_strScriptData);
		}

		/// <summary>
		/// Saves the given script into a text representation.
		/// </summary>
		/// <param name="p_scpScript">The <see cref="IScript"/> to save.</param>
		/// <returns>The text represnetation of the given <see cref="IScript"/>.</returns>
		public string SaveScript(IScript p_scpScript)
		{
			return ((ModScript)p_scpScript).Code;
		}

		/// <summary>
		/// Determines if the given script is valid.
		/// </summary>
		/// <param name="p_scpScript">The script to validate.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		public bool ValidateScript(IScript p_scpScript)
		{
			ModScriptInterpreter msiScriptCompile = new ModScriptInterpreter(((ModScript)p_scpScript).Code);
			return msiScriptCompile.Compile();
		}

        #endregion

        /// <summary>
        /// Returns a proxy that implements the functions available to Mod Script scripts.
        /// </summary>
        /// <param name="modArchive">The mod being installed.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>A proxy that implements the functions available to Mod Script scripts.</returns>
        protected virtual ModScriptFunctionProxy GetScriptFunctionProxy(Mod modArchive, CoreDelegates coreDelegates)
		{
			return new ModScriptFunctionProxy(modArchive, coreDelegates);
		}
	}
}
