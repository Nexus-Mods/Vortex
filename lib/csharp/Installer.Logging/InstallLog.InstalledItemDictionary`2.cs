using System.Collections;
using System.Collections.Generic;

namespace Installer.Logging
{
	public partial class InstallLog
	{
		/// <summary>
		/// A dictionary that maps installed items to the mods that have installed it.
		/// </summary>
		/// <typeparam name="T">The type of the item that is being installed.</typeparam>
		/// <typeparam name="K">The type of the value of the edit to the installed item.</typeparam>
		private class InstalledItemDictionary<T, K> : IEnumerable<InstalledItemDictionary<T, K>.ItemInstallers>
		{
			/// <summary>
			/// Contains the ordered stack of mods that installed a given item.
			/// </summary>
			public class ItemInstallers
			{
				#region Properties

				/// <summary>
				/// Gets the installed item.
				/// </summary>
				/// <value>The installed item.</value>
				public T Item { get; private set; }

				/// <summary>
				/// Gets the ordered stack of mods that have installed the current item.
				/// </summary>
				/// <value>The ordered stack of mods that have installed the current item.</value>
				public InstallerStack<K> Installers { get; private set; }

				#endregion

				#region Constructors

				/// <summary>
				/// A simple constructor that initializes the object with the given values.
				/// </summary>
				/// <param name="p_tItem">The installed item.</param>
				public ItemInstallers(T p_tItem)
				{
					Item = p_tItem;
					Installers = new InstallerStack<K>();
				}

				#endregion
			}

			private Dictionary<T, ItemInstallers> m_dicInstalledItems = null;

			#region Properties

			/// <summary>
			/// Gets the ordered stask of mods that have installed the given item.
			/// </summary>
			/// <param name="p_tItem">The item for which to retrieve the installing mods.</param>
			/// <returns>The ordered stask of mods that have installed the given item.</returns>
			public InstallerStack<K> this[T p_tItem]
			{
				get
				{
					if (!m_dicInstalledItems.ContainsKey(p_tItem))
						m_dicInstalledItems[p_tItem] = new InstalledItemDictionary<T, K>.ItemInstallers(p_tItem);
					return m_dicInstalledItems[p_tItem].Installers;
				}
			}

			#endregion

			#region Constructors

			/// <summary>
			/// The default constructor.
			/// </summary>
			public InstalledItemDictionary()
			{
				m_dicInstalledItems = new Dictionary<T, ItemInstallers>();

			}

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_cmpComparer">The comparer to use when determining if an item is in the dictionary.</param>
			public InstalledItemDictionary(IEqualityComparer<T> p_cmpComparer)
			{
				m_dicInstalledItems = new Dictionary<T, ItemInstallers>(p_cmpComparer);
			}

			#endregion

			/// <summary>
			/// Removes the given item from the dictionary.
			/// </summary>
			/// <param name="p_tItem">The item to remove.</param>
			/// <returns><c>true</c> if the item was in the dictionary;
			/// <c>false</c> otherwise.</returns>
			public bool Remove(T p_tItem)
			{
				return m_dicInstalledItems.Remove(p_tItem);
			}

			/// <summary>
			/// Removes all of the item from the dictionary.
			/// </summary>
			public void Clear()
			{
				m_dicInstalledItems.Clear();
			}

			/// <summary>
			/// Determines if the ditionary contains an entry for the given item.
			/// </summary>
			/// <param name="p_tItem">The item whose presence in the dictionary is to be determined.</param>
			/// <returns><c>true</c> if the given item is in the dictionary;
			/// <c>false</c> otherwise.</returns>
			public bool ContainsItem(T p_tItem)
			{
				return m_dicInstalledItems.ContainsKey(p_tItem);
			}

			#region IEnumerable<InstalledItem<T,K>> Members

			/// <summary>
			/// Gets an enumerator for the installed items in the dictionary.
			/// </summary>
			/// <returns>An enumerator for the installed items in the dictionary.</returns>
			public IEnumerator<InstalledItemDictionary<T, K>.ItemInstallers> GetEnumerator()
			{
				foreach (InstalledItemDictionary<T, K>.ItemInstallers itmItem in m_dicInstalledItems.Values)
					yield return itmItem;
			}

			#endregion

			#region IEnumerable Members

			/// <summary>
			/// Gets an enumerator for the installed items in the dictionary.
			/// </summary>
			/// <returns>An enumerator for the installed items in the dictionary.</returns>
			IEnumerator IEnumerable.GetEnumerator()
			{
				return GetEnumerator();
			}

			#endregion
		}
	}
}
