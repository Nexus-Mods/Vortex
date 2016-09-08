// TODO would be nice if we could get rid of the dependency from system.drawing as it is platform specific
//   and not available in coreclr. mono implements the same api but since it's a wrapper there is no way
//   to say how compatible it actually is.
using System.Drawing;

namespace Scripting
{
	/// <summary>
	/// Describes an option in a Mod Script script's select statement.
	/// </summary>
	public class SelectOption
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
		/// Gets the option's image.
		/// </summary>
		/// <value>The option's image.</value>
		public Image Image { get; private set; }

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
		/// <param name="p_imgImage">The option's image.</param>
		public SelectOption(string p_strName, bool p_booIsDefault, string p_strDescription, Image p_imgImage)
		{
			Name = p_strName;
			IsDefault = p_booIsDefault;
			Description = p_strDescription;
			Image = p_imgImage;
		}

		#endregion
	}
}
