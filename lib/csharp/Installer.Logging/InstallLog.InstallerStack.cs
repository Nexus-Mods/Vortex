using System;
using Util.Collections;

namespace Installer.Logging
{
	public partial class InstallLog
	{
		/// <summary>
		/// Represents a value that was installed by a mod.
		/// </summary>
		/// <typeparam name="K">The type of the value installed by the mod.</typeparam>
		public class InstalledValue<K> : IEquatable<InstalledValue<K>>, IEquatable<string>
		{
			#region Properties

			/// <summary>
			/// Gets the key of the mod that installed the value.
			/// </summary>
			/// <value>The key of the mod that installed the value.</value>
			public string InstallerKey { get; private set; }

			/// <summary>
			/// Gets or sets the installed value.
			/// </summary>
			/// <value>The installed value.</value>
			public K Value { get; set; }
			
			#endregion

			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_strInstallerKey">The key of the mod that installed the value.</param>
			/// <param name="p_kValue">The installed value.</param>
			public InstalledValue(string p_strInstallerKey, K p_kValue)
			{
				InstallerKey = p_strInstallerKey;
				Value = p_kValue;
			}

			#endregion

			#region IEquatable<InstalledValue<K>> Members

			/// <summary>
			/// Determines if this <see cref="InstalledValue{K}"/> is equal to the given
			/// <see cref="InstalledValue{K}"/>.
			/// </summary>
			/// <remarks>
			/// Two <see cref="InstalledValue{K}"/>s are equal if and only if their
			/// <see cref="InstalledValue{K}.InstallerKey"/>s equal.
			/// </remarks>
			/// <param name="other">The <see cref="InstalledValue{K}"/> to compare to this one.</param>
			/// <returns><c>true</c> if the two <see cref="InstalledValue{K}"/>s are equal;
			/// <c>false</c> otherwise.</returns>
			public bool Equals(InstalledValue<K> other)
			{
				return InstallerKey.Equals(other.InstallerKey);
			}

			#endregion

			#region IEquatable<string> Members

			/// <summary>
			/// Determines if this <see cref="InstalledValue{K}"/> is equal to the given
			/// <see cref="string"/>.
			/// </summary>
			/// <remarks>
			/// A <see cref="InstalledValue{K}"/>s is equal to a <see cref="string"/> if and only if
			/// this <see cref="InstalledValue{K}"/>'s <see cref="InstalledValue{K}.InstallerKey"/>
			/// is equal to the <see cref="string"/>.
			/// </remarks>
			/// <param name="other">The <see cref="string"/> to compare to this <see cref="InstalledValue{K}"/>.</param>
			/// <returns><c>true</c> if the this <see cref="InstalledValue{K}"/> is equal to the given
			/// <see cref="string"/>;
			/// <c>false</c> otherwise.</returns>
			public bool Equals(string other)
			{
				return InstallerKey.Equals(other);
			}

			#endregion
		}

		/// <summary>
		/// A stack that is used to track which mods have installed an item.
		/// </summary>
		/// <remarks>
		/// The main purpose of this class is to enforce the use of the <see cref="ModComparer"/>.
		/// </remarks>
		private class InstallerStack<T> : ReorderableStack<InstalledValue<T>>
		{
			#region Constructors

			/// <summary>
			/// The default constructor.
			/// </summary>
			public InstallerStack()
			{
			}

			#endregion

			/// <summary>
			/// Determines the first index of a value installed by the specified mod.
			/// </summary>
			/// <param name="p_strInstallerKey">The key of the installing mod.</param>
			/// <returns>The first index of a value installed by the given mod,
			/// or -1 a value installed by the mod is not in the stack.</returns>
			public int IndexOf(string p_strInstallerKey)
			{
				for (Int32 i = Count - 1; i >= 0; i--)
					if (this[i].Equals(p_strInstallerKey))
						return i;
				return -1;
			}

			/// <summary>
			/// Removes the value installed by the specified mod from the stack.
			/// </summary>
			/// <param name="p_strInstallerKey">The key of the mod whose installed value is to be removed.</param>
			/// <returns><c>true</c> if the value was removed;
			/// <c>false</c> otherwise.</returns>
			public bool Remove(string p_strInstallerKey)
			{
				Int32 intIndex = IndexOf(p_strInstallerKey);
				if (intIndex > -1)
				{
					RemoveAt(intIndex);
					return true;
				}
				return false;
			}

			/// <summary>
			/// Adds a value installed by the specified mod to the top of the stack.
			/// </summary>
			/// <param name="p_strInstallerKey">The key of the mod that installed the given value.</param>
			/// <param name="p_tValue">The value that was installed.</param>
			public void Push(string p_strInstallerKey, T p_tValue)
			{
				Push(new InstalledValue<T>(p_strInstallerKey, p_tValue));
			}

			/// <summary>
			/// Determines if a value installed by the given mod is in the stack.
			/// </summary>
			/// <param name="p_strInstallerKey">The key of the installer mod.</param>
			/// <returns><c>true</c> if a value installed by the given mod is in the stack;
			/// <c>false</c> otherwise.</returns>
			public bool Contains(string p_strInstallerKey)
			{
				return IndexOf(p_strInstallerKey) > -1;
			}
		}
	}
}
