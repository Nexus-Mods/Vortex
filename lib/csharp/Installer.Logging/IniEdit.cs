using System;

namespace Installer.Logging
{
	/// <summary>
	/// Describes an entry in an INI file.
	/// </summary>
	public class IniEdit : IComparable<IniEdit>, IEquatable<IniEdit>
	{
		#region Properties

		/// <summary>
		/// Gets the file containing the entry to edit.
		/// </summary>
		/// <value>The file containing the entry to edit.</value>
		public string File { get; private set; }

		/// <summary>
		/// Gets the section containing the entry to edit.
		/// </summary>
		/// <value>The section containing the entry to edit.</value>
		public string Section { get; private set; }

		/// <summary>
		/// Gets the key of the entry to edit.
		/// </summary>
		/// <value>The key of the entry to edit.</value>
		public string Key { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
		/// <param name="p_strSection">The section containting the INI edit.</param>
		/// <param name="p_strKey">The key of the edited INI value.</param>
		public IniEdit(string p_strSettingsFileName, string p_strSection, string p_strKey)
		{
			File = p_strSettingsFileName;
			Section = p_strSection;
			Key = p_strKey;
		}

		#endregion

		#region IComparable<IniEdit> Members

		/// <summary>
		/// Compares this INI entry to another.
		/// </summary>
		/// <remarks>
		/// INI entries are ordered by file, section, then key, case-insensitively.
		/// </remarks> 
		/// <param name="other">The <see cref="IniEdit"/> to which to compare this one.</param>
		/// <returns>A value less than 0 if this object is less than the other.
		/// 0 if this object is equal to the other.
		/// A value greater than 0 if this object is greater than the other.</returns>
		public int CompareTo(IniEdit other)
		{
			Int32 intResult = StringComparer.OrdinalIgnoreCase.Compare(File, other.File);
			if (intResult == 0)
			{
				intResult = StringComparer.OrdinalIgnoreCase.Compare(Section, other.Section);
				if (intResult == 0)
					intResult = StringComparer.OrdinalIgnoreCase.Compare(Key, other.Key);
			}
			return intResult;
		}

		#endregion

		#region IEquatable<IniEdit> Members

		/// <summary>
		/// Determines if this <see cref="IniEdit"/> is equal to the given
		/// <see cref="IniEdit"/>.
		/// </summary>
		/// <remarks>
		/// Two <see cref="IniEdit"/>s are equal if and only if their
		/// <see cref="File"/>s, <see cref="Section"/>s, and <see cref="Key"/>s
		/// are case-insensitively equal.
		/// </remarks>
		/// <param name="other">The <see cref="IniEdit"/> to compare to this one.</param>
		/// <returns><c>true</c> if the two <see cref="IniEdit"/>s are equal;
		/// <c>false</c> otherwise.</returns>
		public bool Equals(IniEdit other)
		{
			return CompareTo(other) == 0;
		}

		#endregion

		/// <summary>
		/// Gets the hashcode to use for the given <see cref="IniEdit"/>.
		/// </summary>
		/// <remarks>
		/// This override is needed to make (amongst other things) Dicitonaries work as expected when objects of
		/// this type are used as keys. <see cref="GetHashCode()"/> should be overridden whenever
		/// <see cref="Equals(IniEdit)"/> is overridden.
		/// </remarks>
		/// <returns>The hascode to use for the given <see cref="IniEdit"/>.</returns>
		public override int GetHashCode()
		{
			Int32 intHashCode = 53;
			if (!String.IsNullOrEmpty(File))
				intHashCode = intHashCode * 97 + File.GetHashCode();
			if (!String.IsNullOrEmpty(Section))
				intHashCode = intHashCode * 97 + Section.GetHashCode();
			if (!String.IsNullOrEmpty(Key))
				intHashCode = intHashCode * 97 + Key.GetHashCode();
			return intHashCode;
		}
	}
}
