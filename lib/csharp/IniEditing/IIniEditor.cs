using System;

namespace IniEditing
{
	/// <summary>
	/// Interface for classes that can apply/unapply changes to a ini file.
	/// </summary>
	/// <remarks>
	/// An INI installer installs INI value changes.
	/// </remarks>
	public interface IIniEditor
	{
		#region Ini Management

		#region Ini File Value Retrieval

		/// <summary>
		/// Retrieves the specified settings value as a string.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file from which to retrieve the value.</param>
		/// <param name="p_strSection">The section containing the value to retrieve.</param>
		/// <param name="p_strKey">The key of the value to retrieve.</param>
		/// <returns>The specified value as a string.</returns>
		string GetIniString(string p_strSettingsFileName, string p_strSection, string p_strKey);

		/// <summary>
		/// Retrieves the specified settings value as an integer.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file from which to retrieve the value.</param>
		/// <param name="p_strSection">The section containing the value to retrieve.</param>
		/// <param name="p_strKey">The key of the value to retrieve.</param>
		/// <returns>The specified value as an integer.</returns>
		Int32 GetIniInt(string p_strSettingsFileName, string p_strSection, string p_strKey);

		#endregion

		#region Ini Editing

		/// <summary>
		/// Sets the specified value in the specified Ini file to the given value.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file to edit.</param>
		/// <param name="p_strSection">The section in the Ini file to edit.</param>
		/// <param name="p_strKey">The key in the Ini file to edit.</param>
		/// <param name="p_strValue">The value to which to set the key.</param>
		/// <returns><c>true</c> if the value was set; <c>false</c>
		/// if the user chose not to overwrite the existing value.</returns>
		bool EditIni(string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue);

		#endregion

		#region Ini Unediting

		/// <summary>
		/// Undoes the edit made to the spcified key.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file to unedit.</param>
		/// <param name="p_strSection">The section in the Ini file to unedit.</param>
		/// <param name="p_strKey">The key in the Ini file to unedit.</param>
		/// <returns><c>true</c> if the value was undone; <c>false</c> if the key was not changed by the managed mod</returns>
		bool UneditIni(string p_strSettingsFileName, string p_strSection, string p_strKey);

		#endregion

		#endregion

		/// <summary>
		/// Finalizes the installation of the values.
		/// </summary>
		void FinalizeInstall();
	}
}
