using System.Collections.Generic;
using System.Threading;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting
{
	/// <summary>
	/// Describes the properties and methods of a specifc type of mod script.
	/// </summary>
	public interface IScriptType
	{
		#region Properties

		/// <summary>
		/// Gets the name of the script type.
		/// </summary>
		/// <value>The name of the script type.</value>
		string TypeName { get; }

		/// <summary>
		/// Gets the unique id of the script type.
		/// </summary>
		/// <value>The unique id of the script type.</value>
		string TypeId { get; }

		/// <summary>
		/// Gets the list of file names used by scripts of the current type.
		/// </summary>
		/// <remarks>
		/// The list is in order of preference, with the first item being the preferred
		/// file name.
		/// </remarks>
		/// <value>The list of file names used by scripts of the current type.</value>
		IList<string> FileNames { get; }

        #endregion

        /// <summary>
        /// Creates an executor that can run the script type.
        /// </summary>
        /// <param name="modArchive">The mod being installed.</param>
        /// <param name="userInteractionDelegate">The application's envrionment info.</param>
        /// <returns>An executor that can run the script type.</returns>
        IScriptExecutor CreateExecutor(Mod modArchive, CoreDelegates delegates);

		/// <summary>
		/// Loads the script from the given text representation.
		/// </summary>
		/// <param name="p_strScriptData">The text to convert into a script.</param>
		/// <returns>The <see cref="IScript"/> represented by the given data.</returns>
		IScript LoadScript(string p_strScriptData);

		/// <summary>
		/// Saves the given script into a text representation.
		/// </summary>
		/// <param name="p_scpScript">The <see cref="IScript"/> to save.</param>
		/// <returns>The text represnetation of the given <see cref="IScript"/>.</returns>
		string SaveScript(IScript p_scpScript);

		/// <summary>
		/// Determines if the given script is valid.
		/// </summary>
		/// <param name="p_scpScript">The script to validate.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		bool ValidateScript(IScript p_scpScript);
	}
}
