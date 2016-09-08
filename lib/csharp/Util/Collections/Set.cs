using System;
using System.Collections;
using System.Collections.Generic;

namespace Util.Collections
{
	/// <summary>
	/// A Set implementation.
	/// </summary>
	/// <typeparam name="T">The type of objects in the Set.</typeparam>
	public class Set<T> : IList<T>, ICollection<T>, IEnumerable<T>, IList, ICollection, IEnumerable
	{
		private List<T> m_lstList = new List<T>();
		private IComparer<T> m_cmpComparer = null;

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public Set()
		{
		}

		/// <summary>
		/// A constructor that fills the set with the given items.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the set.</param>
		public Set(IEnumerable<T> p_enmItems)
		{
			AddRange(p_enmItems);
		}

		/// <summary>
		/// A constructor that fills the set with the given items, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the set.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the set.</param>
		public Set(IEnumerable<T> p_enmItems, IComparer<T> p_cmpComparer)
		{
			AddRange(p_enmItems);
			m_cmpComparer = p_cmpComparer;
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the set.</param>
		public Set(IComparer<T> p_cmpComparer)
		{
			m_cmpComparer = p_cmpComparer;
		}

		/// <summary>
		/// The copy constructor.
		/// </summary>
		/// <param name="p_setCopy">The set to copy.</param>
		public Set(Set<T> p_setCopy)
		{
			AddRange(p_setCopy);
			m_cmpComparer = p_setCopy.m_cmpComparer;
		}

		#endregion

		/// <summary>
		/// Finds the first item that matches the given predicate.
		/// </summary>
		/// <param name="match">The predicate against which to match the items.</param>
		/// <returns>The first item that matches the given predicate, or <c>null</c>
		/// if no matching item is found.</returns>
		public T Find(Predicate<T> match)
		{
			return m_lstList.Find(match);
		}

		/// <summary>
		/// Gets an array containing the items in the set.
		/// </summary>
		/// <returns>An array containing the items in the set.</returns>
		public T[] ToArray()
		{
			T[] tSet = new T[Count];
			CopyTo(tSet, 0);
			return tSet;
		}

		/// <summary>
		/// Adds the given items to the set.
		/// </summary>
		/// <param name="p_enmItems">The items to add.</param>
		public void AddRange(IEnumerable<T> p_enmItems)
		{
			foreach (T tItem in p_enmItems)
				AddImpl(tItem);
		}

		/// <summary>
		/// Sorts the set.
		/// </summary>
		public void Sort()
		{
			if (m_cmpComparer != null)
				m_lstList.Sort(m_cmpComparer);
			else
				m_lstList.Sort();
		}

		/// <summary>
		/// Performs the given action for each item in the set.
		/// </summary>
		/// <param name="p_actAction">The action to perform for each item in the set.</param>
		public void ForEach(Action<T> p_actAction)
		{
			m_lstList.ForEach(p_actAction);
		}

		#region IndexOf

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the set is to be found.</param>
		/// <param name="p_intStartIndex">The zero-based index where to start the search.</param>
		/// <returns>The first index of the specified item, or -1 if the item is not in the set.</returns>
		public Int32 IndexOf(T p_tItem, Int32 p_intStartIndex)
		{
			if (m_cmpComparer != null)
			{
				for (Int32 i = p_intStartIndex; i < this.Count; i++)
					if (m_cmpComparer.Compare(this[i], p_tItem) == 0)
						return i;
				return -1;
			}
			return m_lstList.IndexOf(p_tItem, p_intStartIndex);
		}

		/// <summary>
		/// Determines the last index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the set is to be found.</param>
		/// <returns>The last index of the specified item, or -1 if the item is not in the set.</returns>
		public Int32 LastIndexOf(T p_tItem)
		{
			return LastIndexOf(p_tItem, Count - 1);
		}

		/// <summary>
		/// Determines the last index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the set is to be found.</param>
		/// <param name="p_intStartIndex">The zero-based index where to start the search.</param>
		/// <returns>The last index of the specified item, or -1 if the item is not in the set.</returns>
		public Int32 LastIndexOf(T p_tItem, Int32 p_intStartIndex)
		{
			if (m_cmpComparer != null)
			{
				for (Int32 i = p_intStartIndex; i > 0; i++)
					if (m_cmpComparer.Compare(this[i], p_tItem) == 0)
						return i;
				return -1;
			}
			return m_lstList.LastIndexOf(p_tItem, p_intStartIndex);
		}

		#endregion

		#region IList<T> Members

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the set is to be found.</param>
		/// <returns>The first index of the specified item, or -1 if the item is not in the set.</returns>
		public Int32 IndexOf(T p_tItem)
		{
			return IndexOf(p_tItem, 0);
		}

		/// <summary>
		/// Inserts the given item at the specifed index. Cannot be used with a set.
		/// </summary>
		/// <remarks>
		/// This operation doesn't make sense in a set.
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		/// <exception cref="InvalidOperationException">Thrown always.</exception>
		public void Insert(int index, T item)
		{
			throw new InvalidOperationException("Cannot insert into a set.");
		}

		/// <summary>
		/// Removes the item form the set at the given index.
		/// </summary>
		/// <param name="index">The index of the item to remove from the set.</param>
		public virtual void RemoveAt(int index)
		{
			m_lstList.RemoveAt(index);
		}

		/// <summary>
		/// Gets or sets the item at the specified index. Indexed setting cannot be used with a set.
		/// </summary>
		/// <remarks>
		/// The setting of an indexed item doesn't make sense in a set.
		/// </remarks>
		/// <param name="index">The index of the item to get or set.</param>
		/// <returns>The requrested item.</returns>
		/// <exception cref="InvalidOperationException">Thrown if the setting of an index item is attempted.</exception>
		public T this[int index]
		{
			get
			{
				return m_lstList[index];
			}
			set
			{
				throw new InvalidOperationException("Cannot set an indexed item of a set.");
			}
		}

		#endregion

		private void AddImpl(T p_tItem)
		{
			if (!Contains(p_tItem))
				m_lstList.Add(p_tItem);
		}

		#region ICollection<T> Members

		/// <summary>
		/// Adds the given item to the set.
		/// </summary>
		/// <param name="p_tItem">The item to add.</param>
		public virtual void Add(T p_tItem)
		{
			AddImpl(p_tItem);
		}

		/// <summary>
		/// Empties the set.
		/// </summary>
		public virtual void Clear()
		{
			m_lstList.Clear();
		}

		/// <summary>
		/// Determines if the given item is in the set.
		/// </summary>
		/// <param name="p_tItem">The item to look for in the set.</param>
		/// <returns><c>true</c> if the item is in the set;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(T p_tItem)
		{
			return IndexOf(p_tItem) > -1;
		}

		/// <summary>
		/// Copies the contents of the set to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="arrayIndex">The index in the array at which to start copying the items.</param>
		public void CopyTo(T[] array, int arrayIndex)
		{
			m_lstList.CopyTo(array, arrayIndex);
		}

		/// <summary>
		/// Gets the number of items in the set.
		/// </summary>
		/// <value>The number of items in the set.</value>
		public int Count
		{
			get
			{
				return m_lstList.Count;
			}
		}

		/// <summary>
		/// Gets whether the set is read-only. Always <c>false</c>.
		/// </summary>
		/// <value>Whether the set is read-only. Always <c>false</c>.</value>
		public bool IsReadOnly
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Removes the given item from the set.
		/// </summary>
		/// <param name="p_tItem">The item to remove</param>
		/// <returns><c>true</c> if the item was removed;
		/// <c>false</c> otherwise.</returns>
		public bool Remove(T p_tItem)
		{
			Int32 intIndex = IndexOf(p_tItem);
			if (intIndex > -1)
			{
				RemoveAt(intIndex);
				return true;
			}
			return false;
		}

		#endregion

		#region IEnumerable<T> Members

		/// <summary>
		/// Gets an enumerator for this items in the set.
		/// </summary>
		/// <returns>An enumerator for this items in the set.</returns>
		public IEnumerator<T> GetEnumerator()
		{
			return m_lstList.GetEnumerator();
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for this items in the set.
		/// </summary>
		/// <returns>An enumerator for this items in the set.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable)m_lstList).GetEnumerator();
		}

		#endregion

		#region IList Members

		/// <summary>
		/// Adds the given item to the set.
		/// </summary>
		/// <param name="value">The item to add.</param>
		int IList.Add(object value)
		{
			if (!(value is T))
				throw new InvalidOperationException("Can only add items of type " + typeof(T) + " to the Set.");
			Add((T)value);
			return ((IList)this).IndexOf(value);
		}

		/// <summary>
		/// Determines if the given item is in the set.
		/// </summary>
		/// <param name="value">The item to look for in the set.</param>
		/// <returns><c>true</c> if the item is in the set;
		/// <c>false</c> otherwise.</returns>
		bool IList.Contains(object value)
		{
			if (!(value is T))
				return false;
			return Contains((T)value);
		}

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="value">The item whose index in the set is to be found.</param>
		/// <returns>The first index of the specified item, or -1 if the item is not in the set.</returns>
		int IList.IndexOf(object value)
		{
			if (!(value is T))
				return -1;
			return IndexOf((T)value);
		}

		/// <summary>
		/// Inserts the given item at the specifed index. Cannot be used with a set.
		/// </summary>
		/// <remarks>
		/// This operation doesn't make sense in a set.
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="value">The item to insert.</param>
		/// <exception cref="InvalidOperationException">Thrown always.</exception>
		void IList.Insert(int index, object value)
		{
			if (!(value is T))
				throw new InvalidOperationException("Can only add items of type " + typeof(T) + " to the Set.");
			Insert(index, (T)value);
		}

		/// <summary>
		/// Gets whether the set is fixed size. Always <c>false</c>.
		/// </summary>
		/// <value>Whether the set is fixed size. Always <c>false</c>.</value>
		public bool IsFixedSize
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Removes the given item from the set.
		/// </summary>
		/// <param name="value">The item to remove</param>
		void IList.Remove(object value)
		{
			if (value is T)
				Remove((T)value);
		}

		/// <summary>
		/// Gets or sets the item ate the specified index. Indexed setting cannot be used with a set.
		/// </summary>
		/// <remarks>
		/// The setting of an indexed item doesn't make sense in a set.
		/// </remarks>
		/// <param name="index">The index of the item to get or set.</param>
		/// <returns>Nothing.</returns>
		/// <exception cref="InvalidOperationException">Thrown if the setting of an index item is attempted.</exception>
		object IList.this[int index]
		{
			get
			{
				return m_lstList[index];
			}
			set
			{
				throw new NotImplementedException();
			}
		}

		#endregion

		#region ICollection Members

		/// <summary>
		/// Copies the contents of the set to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="index">The index in the array at which to start copying the items.</param>
		void ICollection.CopyTo(Array array, int index)
		{
			Array.Copy(ToArray(), array, index);
		}

		/// <summary>
		/// Gets whether the set is synchronized.
		/// </summary>
		/// <value>Whether the set is synchronized.</value>
		public bool IsSynchronized
		{
			get
			{
				return ((ICollection)m_lstList).IsSynchronized;
			}
		}

		/// <summary>
		/// Gets the sync root of the set.
		/// </summary>
		/// <value>The sync root of the set.</value>
		public object SyncRoot
		{
			get
			{
				return ((ICollection)m_lstList).SyncRoot;
			}
		}

		#endregion

		/// <summary>
		/// Returns a string representation of the set.
		/// </summary>
		/// <returns>A string representation of the set.</returns>
		public override string ToString()
		{
			return String.Format("Count = {0}", Count);
		}
	}
}
