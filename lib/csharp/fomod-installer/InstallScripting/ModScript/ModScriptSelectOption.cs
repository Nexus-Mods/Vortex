using System;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Describes an option in a Mod Script script's select statement.
	/// </summary>
	[Serializable]
	public class ModScriptSelectOption
	{
		#region Properties

		/// <summary>
		/// Gets the name of the option.
		/// </summary>
		/// <value>The name of the option.</value>
		public string Name { get; private set; }

		/// <summary>
		/// Gets the description of the option.
		/// </summary>
		/// <value>The description of the option.</value>
		public string Description { get; private set; }

		/// <summary>
		/// Gets the path in the mod of the option's image.
		/// </summary>
		/// <value>The path in the mod of the option's image.</value>
		public string ImagePath { get; private set; }

		/// <summary>
		/// Gets or sets whether the option is a default.
		/// </summary>
		/// <value>Whether the option is a default.</value>
		public bool IsDefault { get; set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the option.</param>
		/// <param name="p_booIsDefault">Whether the option is a default.</param>
		/// <param name="p_strDescription">The description of the option.</param>
		/// <param name="p_strImagePath">The path in the mod of the option's image.</param>
		public ModScriptSelectOption(string p_strName, bool p_booIsDefault, string p_strDescription, string p_strImagePath)
		{
			Name = p_strName;
			IsDefault = p_booIsDefault;
			Description = p_strDescription;
			ImagePath = p_strImagePath;
		}

		#endregion
	}
}
