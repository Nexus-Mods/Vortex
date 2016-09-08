using System;
using System.Collections;
using System.Collections.Generic;

namespace Util.Collections
{
	/// <summary>
	/// A list whose items are sorted.
	/// </summary>
	/// <typeparam name="T"></typeparam>
	public class SortedList<T> : IList<T>
	{
		private List<T> m_lstItems = null;
		private IComparer<T> m_cmpComparer = null;

		#region Properties

		/// <summary>
		/// Gets the underlying list of items.
		/// </summary>
		/// <value>The underlying list of items.</value>
		protected List<T> Items
		{
			get
			{
				return m_lstItems;
			}
		}

		/// <summary>
		/// Sets the <see cref="IComparer"/> used to sort the items.
		/// </summary>
		/// <value>The <see cref="IComparer"/> used to sort the items.</value>
		public virtual IComparer<T> Comparer
		{
			set
			{
				m_cmpComparer = value;
				if (value != null)
					Items.Sort(value);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public SortedList()
			: this(null, null)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list.
		/// </summary>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		public SortedList(IEnumerable<T> p_enmItems)
			: this(p_enmItems, null)
		{
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the sorted list.</param>
		public SortedList(IComparer<T> p_cmpComparer)
			: this(null, p_cmpComparer)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the sorted list.</param>
		public SortedList(IEnumerable<T> p_enmItems, IComparer<T> p_cmpComparer)
		{
			if (!typeof(IComparable<T>).IsAssignableFrom(typeof(T)) && (p_cmpComparer == null))
				throw new ArgumentException("Type " + typeof(T).Name + " is not IComparable. Use SortedList(IComparer) to supply a comparer.");
			m_lstItems = (p_enmItems == null) ? new List<T>() : new List<T>(p_enmItems);
			m_cmpComparer = p_cmpComparer;
			if (m_cmpComparer != null)
				m_lstItems.Sort(m_cmpComparer);
			else
				m_lstItems.Sort();
		}

		#endregion

		#region IList<T> Members

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the sorted list is to be found.</param>
		/// <returns>The first index of the specified item, or a negative number that is the bitwise
		/// complement of the next largest item if the item is not in the sorted list.</returns>
		public int IndexOf(T p_tItem)
		{
			if (m_cmpComparer == null)
				return m_lstItems.BinarySearch(p_tItem);
			return m_lstItems.BinarySearch(p_tItem, m_cmpComparer);
		}

		/// <summary>
		/// Inserts the given item at the specifed index. Cannot be used with a sorted list.
		/// </summary>
		/// <remarks>
		/// This operation doesn't make sense in a sorted list.
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		/// <exception cref="InvalidOperationException">Thrown always.</exception>
		public void Insert(int index, T item)
		{
			throw new InvalidOperationException("The method or operation cannot be performed on an Ordered List.");
		}

		/// <summary>
		/// Removes the item form the sorted list at the given index.
		/// </summary>
		/// <param name="index">The index of the item to remove from the sorted list.</param>
		public virtual void RemoveAt(int index)
		{
			m_lstItems.RemoveAt(index);
		}

		/// <summary>
		/// Gets or sets the item ate the specified index. Indexed setting cannot be used with a sorted list.
		/// </summary>
		/// <remarks>
		/// The setting of an indexed item doesn't make sense in a sorted list.
		/// </remarks>
		/// <param name="index">The index of the item to get or set.</param>
		/// <returns>Nothing.</returns>
		/// <exception cref="InvalidOperationException">Thrown if the setting of an index item is attempted.</exception>
		public T this[int index]
		{
			get
			{
				return m_lstItems[index];
			}
			set
			{
				throw new InvalidOperationException("The method or operation cannot be performed on an Ordered List.");
			}
		}

		#endregion

		#region ICollection<T> Members

		/// <summary>
		/// Adds the given item to the sorted list.
		/// </summary>
		/// <param name="p_tItem">The item to add.</param>
		public virtual void Add(T p_tItem)
		{
			Int32 intIndex = -1;
			if (m_cmpComparer == null)
				intIndex = m_lstItems.BinarySearch(p_tItem);
			intIndex = m_lstItems.BinarySearch(p_tItem, m_cmpComparer);

			if (intIndex < 0)
				intIndex = ~intIndex;

			m_lstItems.Insert(intIndex, p_tItem);
		}

		/// <summary>
		/// Empties the sorted list.
		/// </summary>
		public virtual void Clear()
		{
			m_lstItems.Clear();
		}

		/// <summary>
		/// Determines if the given item is in the sorted list.
		/// </summary>
		/// <param name="p_tItem">The item to look for in the sorted list.</param>
		/// <returns><c>true</c> if the item is in the sorted list;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(T p_tItem)
		{
			Int32 intIndex = -1;
			if (m_cmpComparer == null)
				intIndex = m_lstItems.BinarySearch(p_tItem);
			intIndex = m_lstItems.BinarySearch(p_tItem, m_cmpComparer);
			return intIndex > -1;
		}

		/// <summary>
		/// Copies the contents of the sorted list to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="arrayIndex">The index in the array at which to start copying the items.</param>
		public void CopyTo(T[] array, int arrayIndex)
		{
			m_lstItems.CopyTo(array, arrayIndex);
		}

		/// <summary>
		/// Gets the number of items in the sorted list.
		/// </summary>
		/// <value>The number of items in the sorted list.</value>
		public int Count
		{
			get
			{
				return m_lstItems.Count;
			}
		}

		/// <summary>
		/// Gets whether the sorted list is read-only. Always <c>false</c>.
		/// </summary>
		/// <value>Whether the sorted list is read-only. Always <c>false</c>.</value>
		public bool IsReadOnly
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Removes the given item from the sorted list.
		/// </summary>
		/// <param name="p_tItem">The item to remove</param>
		/// <returns><c>true</c> if the item was removed;
		/// <c>false</c> otherwise.</returns>
		public virtual bool Remove(T p_tItem)
		{
			Int32 intIndex = -1;
			if (m_cmpComparer == null)
				intIndex = m_lstItems.BinarySearch(p_tItem);
			intIndex = m_lstItems.BinarySearch(p_tItem, m_cmpComparer);
			if (intIndex > -1)
			{
				m_lstItems.RemoveAt(intIndex);
				return true;
			}
			return false;
		}

		#endregion

		#region IEnumerable<T> Members

		/// <summary>
		/// Gets an enumerator for this items in the sorted list.
		/// </summary>
		/// <returns>An enumerator for this items in the sorted list.</returns>
		public IEnumerator<T> GetEnumerator()
		{
			return m_lstItems.GetEnumerator();
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for this items in the sorted list.
		/// </summary>
		/// <returns>An enumerator for this items in the sorted list.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable)m_lstItems).GetEnumerator();
		}

		#endregion

	}
}
