using System;

namespace Mods
{
	/// <summary>
	/// Compares <see cref="IMod"/>s based on their <see cref="IMod.Filename"/>s.
	/// </summary>
	/// <remarks>
	/// In the constext of this comparer, <see cref="IMod"/>s are strictly ordered
	/// by their ordinally case-insensitive <see cref="IMod.Filename"/>s.
	/// </remarks>
	public class FilenameModComparer : ModComparer
	{
		/// <summary>
		/// Gets the hashcode to use for the given <see cref="IMod"/>.
		/// </summary>
		/// <param name="obj">The <see cref="IMod"/> whose hashcode is to be determined.</param>
		/// <returns>The hascode to use for the given <see cref="IMod"/>.</returns>
		public override int GetHashCode(IMod obj)
		{
			if ((obj == null) || (obj.Filename == null))
				return 53;
			return obj.Filename.GetHashCode();
		}

		/// <summary>
		/// Compares the given <see cref="IMod"/>s.
		/// </summary>
		/// <param name="x">An object to compare to another object.</param>
		/// <param name="y">An object to compare to another object.</param>
		/// <returns>A value less than 0 if <paramref name="x"/> is less than <paramref name="y"/>.
		/// 0 if this node is equal to the other.
		/// A value greater than 0 if <paramref name="x"/> is greater than <paramref name="y"/>.</returns>
		public override int Compare(IMod x, IMod y)
		{
			if (x == null)
				return (y == null) ? 0 : -1;
			if (y == null)
				return 1;
			return StringComparer.OrdinalIgnoreCase.Compare(x.Filename, y.Filename);
		}
	}
}
