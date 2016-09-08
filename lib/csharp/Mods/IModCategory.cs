using System;

namespace Mods
{
	/// <summary>
	/// A contract specifying an object that contains information about a mod category.
	/// </summary>
	public interface IModCategory
	{
		#region Properties

		/// <summary>
		/// Gets or sets the Id of the category.
		/// </summary>
		/// <remarks>The id of the category</remarks>
		Int32 Id { get; set; }

		/// <summary>
		/// Gets or sets the name of the category.
		/// </summary>
		/// <value>The name of the category.</value>
		string CategoryName { get; set; }

		/// <summary>
		/// Gets or sets the path to the category.
		/// </summary>
		/// <value>The path to the category.</value>
		string CategoryPath { get; set; }

		/// <summary>
		/// Gets or sets the number of new mods in the category.
		/// </summary>
		/// <value>The number of new mods in the category.</value>
		Int32 NewMods { get; set; }

		#endregion
	}
}
