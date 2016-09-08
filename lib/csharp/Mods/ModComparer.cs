using System.Collections;
using System.Collections.Generic;

namespace Mods
{
	/// <summary>
	/// Provides base functionality of classes that compare two <see cref="IMod"/>s.
	/// </summary>
	/// <remarks>
	/// This class provide static access to some standard <see cref="IMod"/> comparers.
	/// </remarks>
	public abstract class ModComparer : IComparer, IEqualityComparer, IComparer<IMod>, IEqualityComparer<IMod>
	{
		private static ModComparer m_fmdFilename = null;

		#region Standard Comparers

		/// <summary>
		/// Gets a comparer that compares <see cref="IMod"/>s based on their <see cref="IMod.Filename"/>s.
		/// </summary>
		/// <value>A comparer that compares <see cref="IMod"/>s based on their <see cref="IMod.Filename"/>s.</value>
		public static ModComparer Filename
		{
			get
			{
				return m_fmdFilename ?? (m_fmdFilename = new FilenameModComparer());
			}
		}

		#endregion

		#region IEqualityComparer<IMod> Members

		/// <summary>
		/// Determines if the given <see cref="IMod"/>s are equal.
		/// </summary>
		/// <param name="x">A <see cref="IMod"/> whose equality is being checked.</param>
		/// <param name="y">A <see cref="IMod"/> whose equality is being checked.</param>
		/// <returns><c>true</c> if the two <see cref="IMod"/>s are equal;
		/// <c>false</c> otherwise.</returns>
		public bool Equals(IMod x, IMod y)
		{
			return Compare(x, y) == 0;
		}

		/// <summary>
		/// Gets the hashcode to use for the given <see cref="IMod"/>.
		/// </summary>
		/// <param name="obj">The <see cref="IMod"/> whose hashcode is to be determined.</param>
		/// <returns>The hascode to use for the given <see cref="IMod"/>.</returns>
		public abstract int GetHashCode(IMod obj);

		#endregion

		#region IComparer<IMod> Members

		/// <summary>
		/// Compares the given <see cref="IMod"/>s.
		/// </summary>
		/// <param name="x">An object to compare to another object.</param>
		/// <param name="y">An object to compare to another object.</param>
		/// <returns>A value less than 0 if <paramref name="x"/> is less than <paramref name="y"/>.
		/// 0 if this node is equal to the other.
		/// A value greater than 0 if <paramref name="x"/> is greater than <paramref name="y"/>.</returns>
		public abstract int Compare(IMod x, IMod y);

		#endregion

		#region IEqualityComparer Members

		/// <summary>
		/// Determines if the given <see cref="IMod"/>s are equal.
		/// </summary>
		/// <param name="x">A <see cref="IMod"/> whose equality is being checked.</param>
		/// <param name="y">A <see cref="IMod"/> whose equality is being checked.</param>
		/// <returns><c>true</c> if the two <see cref="IMod"/>s are equal;
		/// <c>false</c> otherwise.</returns>
		bool IEqualityComparer.Equals(object x, object y)
		{
			return Equals(x as IMod, y as IMod);
		}

		/// <summary>
		/// Gets the hashcode to use for the given <see cref="IMod"/>.
		/// </summary>
		/// <param name="obj">The <see cref="IMod"/> whose hashcode is to be determined.</param>
		/// <returns>The hascode to use for the given <see cref="IMod"/>.</returns>
		int IEqualityComparer.GetHashCode(object obj)
		{
			return GetHashCode(obj as IMod);
		}

		#endregion

		#region IComparer Members

		/// <summary>
		/// Compares the given <see cref="IMod"/>s.
		/// </summary>
		/// <param name="x">An object to compare to another object.</param>
		/// <param name="y">An object to compare to another object.</param>
		/// <returns>A value less than 0 if <paramref name="x"/> is less than <paramref name="y"/>.
		/// 0 if this node is equal to the other.
		/// A value greater than 0 if <paramref name="x"/> is greater than <paramref name="y"/>.</returns>
		int IComparer.Compare(object x, object y)
		{
			return Compare(x as IMod, y as IMod);
		}

		#endregion
	}
}
