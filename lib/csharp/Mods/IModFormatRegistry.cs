using System.Collections.Generic;

namespace Mods
{
	/// <summary>
	/// Describes the properties and methods of a mod format.
	/// </summary>
	/// <remarks>
	/// A mod format registry lists supported mod formats.
	/// </remarks>
	public interface IModFormatRegistry
	{
		#region Properties

		/// <summary>
		/// Gets the registered <see cref="IModFormat"/>s.
		/// </summary>
		/// <value>The registered <see cref="IModFormat"/>s.</value>
		ICollection<IModFormat> Formats { get; }

		#endregion

		/// <summary>
		/// Registers the given <see cref="IModFormat"/>.
		/// </summary>
		/// <param name="p_mftFormat">A <see cref="IModFormat"/> to register.</param>
		void RegisterFormat(IModFormat p_mftFormat);

		/// <summary>
		/// Gets the specified <see cref="IModFormat"/>.
		/// </summary>
		/// <param name="p_strModFormatId">The id of the <see cref="IModFormat"/> to retrieve.</param>
		/// <returns>The <see cref="IModFormat"/> whose id matches the given id. <c>null</c> is returned
		/// if no <see cref="IModFormat"/> with the given id is in the registry.</returns>
		IModFormat GetFormat(string p_strModFormatId);
	}
}
