using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Threading;

namespace Utils.Collections
{
	/// <summary>
	/// This is a list whose operations are thread safe, and that notifes listeners about changes to the list.
	/// The main difference between this list and others is that all methods that operate over the entire
	/// list, such as <see cref="GetEnumerator()"/>, do so over a snapshot of the list, as opposed
	/// to the list itself.
	/// </summary>
	/// <typeparam name="T">The type of the items in the list.</typeparam>
	public class ThreadSafeObservableList<T> : IList<T>, INotifyCollectionChanged, INotifyPropertyChanged
	{
		protected ReaderWriterLockSlim m_rwlLock = new ReaderWriterLockSlim(LockRecursionPolicy.SupportsRecursion);
		private List<T> m_lstItems = null;
		private IComparer<T> m_cmpComparer = null;

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ThreadSafeObservableList()
			: this(null, null)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list.
		/// </summary>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		public ThreadSafeObservableList(IEnumerable<T> p_enmItems)
			: this(p_enmItems, null)
		{
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when comparing items in the list.</param>
		public ThreadSafeObservableList(IComparer<T> p_cmpComparer)
			: this(null, p_cmpComparer)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		/// <param name="p_cmpComparer">The comparer to use when comparing items in the list.</param>
		public ThreadSafeObservableList(IEnumerable<T> p_enmItems, IComparer<T> p_cmpComparer)
		{
			m_lstItems = (p_enmItems == null) ? new List<T>() : new List<T>(p_enmItems);
			m_cmpComparer = p_cmpComparer;
		}

		#endregion

		#region IList<T> Members

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the sorted list is to be found.</param>
		/// <returns>The first index of the specified item, or <c>-1</c> if the item is not in the list.</returns>
		public int IndexOf(T p_tItem)
		{
			try
			{
				m_rwlLock.EnterReadLock();
				if (m_cmpComparer == null)
					return m_lstItems.IndexOf(p_tItem);
				for (Int32 i = 0; i < m_lstItems.Count; i++)
					if (m_cmpComparer.Compare(m_lstItems[i], p_tItem) == 0)
						return i;
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
			return -1;
		}

		/// <summary>
		/// Inserts the given item at the specifed index.
		/// </summary>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		public void Insert(int index, T item)
		{
			try
			{
				m_rwlLock.EnterWriteLock();
				InsertItem(index, item);
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
			OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, item, index));
			OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
		}

		/// <summary>
		/// Removes the item form the list at the given index.
		/// </summary>
		/// <param name="index">The index of the item to remove from the list.</param>
		public void RemoveAt(int index)
		{
			T tOldItem = default(T);
			try
			{
				m_rwlLock.EnterWriteLock();
				tOldItem = this[index];
				m_lstItems.RemoveAt(index);
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
			OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Remove, tOldItem, index));
			OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
		}

		/// <summary>
		/// Gets or sets the item at the specified index.
		/// </summary>
		/// <param name="index">The index of the item to get or set.</param>
		/// <returns>The item at the given index.</returns>
		public T this[int index]
		{
			get
			{
				return (index >= m_lstItems.Count ? default(T) : m_lstItems[index]);
			}
			set
			{
				T tOldItem = default(T);
				try
				{
					m_rwlLock.EnterWriteLock();
					tOldItem = m_lstItems[index];
					SetItem(index, value);
				}
				finally
				{
					if (m_rwlLock.IsWriteLockHeld)
						m_rwlLock.ExitWriteLock();
				}
				OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Replace, value, tOldItem, index));
			}
		}

		#endregion

		#region ICollection<T> Members

		/// <summary>
		/// Adds the given item to the list.
		/// </summary>
		/// <param name="p_tItem">The item to add.</param>
		public void Add(T p_tItem)
		{
			Int32 intIndex = 0;
			try
			{
				m_rwlLock.EnterWriteLock();
				intIndex = Count;
				InsertItem(Count, p_tItem);
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
			OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, p_tItem, intIndex));
			OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
		}

		/// <summary>
		/// Empties the list.
		/// </summary>
		public void Clear()
		{
			List<T> lstOldItems = new List<T>();
			try
			{
				m_rwlLock.EnterWriteLock();
				lstOldItems.AddRange(m_lstItems);
				m_lstItems.Clear();
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
			if (lstOldItems.Count > 0)
			{
				OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
				OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
			}
		}

		/// <summary>
		/// Determines if the given item is in the list.
		/// </summary>
		/// <param name="p_tItem">The item to look for in the list.</param>
		/// <returns><c>true</c> if the item is in the list;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(T p_tItem)
		{
			try
			{
				m_rwlLock.EnterReadLock();
				Int32 intIndex = IndexOf(p_tItem);
				return intIndex > -1;
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
		}

		/// <summary>
		/// Copies the contents of the list to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="arrayIndex">The index in the array at which to start copying the items.</param>
		public void CopyTo(T[] array, int arrayIndex)
		{
			try
			{
				m_rwlLock.EnterReadLock();
				m_lstItems.CopyTo(array, arrayIndex);
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
		}

		/// <summary>
		/// Gets the number of items in the list.
		/// </summary>
		/// <value>The number of items in the list.</value>
		public int Count
		{
			get
			{
				return m_lstItems.Count;
			}
		}

		/// <summary>
		/// Gets whether the list is read-only. Always <c>false</c>.
		/// </summary>
		/// <value>Whether the list is read-only. Always <c>false</c>.</value>
		public bool IsReadOnly
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Removes the given item from the list.
		/// </summary>
		/// <param name="p_tItem">The item to remove</param>
		/// <returns><c>true</c> if the item was removed;
		/// <c>false</c> otherwise.</returns>
		public bool Remove(T p_tItem)
		{
			try
			{
				m_rwlLock.EnterWriteLock();
				Int32 intIndex = IndexOf(p_tItem);
				if (intIndex > -1)
				{
					RemoveAt(intIndex);
					return true;
				}
				return false;
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
		}

		#endregion

		#region IEnumerable<T> Members

		/// <summary>
		/// Gets an enumerator for the items in the list.
		/// </summary>
		/// <remarks>
		/// This method creates an iterator for a copy of the list at the moment when the method was called.
		/// As such, a <see cref="InvalidOperation"/> due to the collection having been changed will never
		/// be thrown, and operations using the enumerator will continue even if the list is changed.
		/// </remarks>
		/// <returns>An enumerator for the items in the list.</returns>
		public IEnumerator<T> GetEnumerator()
		{
			try
			{
				m_rwlLock.EnterReadLock();
				List<T> lstItems = new List<T>(this);
				return lstItems.GetEnumerator();
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for the items in the list.
		/// </summary>
		/// <remarks>
		/// This method creates an iterator for a copy of the list at the moment when the method was called.
		/// As such, a <see cref="InvalidOperation"/> due to the collection having been changed will never
		/// be thrown, and operations using the enumerator will continue even if the list is changed.
		/// </remarks>
		/// <returns>An enumerator for the items in the list.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			try
			{
				m_rwlLock.EnterReadLock();
				T[] tItems = (T[])Array.CreateInstance(typeof(T), Count);
				m_lstItems.CopyTo(tItems, 0);
				return tItems.GetEnumerator();
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
		}

		#endregion

		#region INotifyCollectionChanged Members

		/// <summary>
		/// Raised when the collection changes.
		/// </summary>
		public event NotifyCollectionChangedEventHandler CollectionChanged = delegate { };

		#endregion

		#region INotifyPropertyChanged Members

		/// <summary>
		/// Raised when a property of the collection changes.
		/// </summary>
		public event PropertyChangedEventHandler PropertyChanged = delegate { };

		#endregion

		#region Event Raising

		/// <summary>
		/// Raises the <see cref="CollectionChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		protected virtual void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
		{
			CollectionChanged(this, e);
		}

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		protected virtual void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			PropertyChanged(this, e);
		}

		#endregion

		/// <summary>
		/// Sets the specified index to the given item.
		/// </summary>
		/// <param name="index">The index at which to set the item.</param>
		/// <param name="item">The item to set.</param>
		protected virtual void SetItem(int index, T item)
		{
			m_lstItems[index] = item;
		}

		/// <summary>
		/// Inserts the given item at the given index.
		/// </summary>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		protected virtual void InsertItem(int index, T item)
		{
			m_lstItems.Insert(index, item);
		}

		/// <summary>
		/// Moves the item from the specified From index to the specified
		/// To index.
		/// </summary>
		/// <param name="p_intFromIndex">The index of the item to move.</param>
		/// <param name="p_intToIndex">The index to which to move the item.</param>
		public virtual void Move(Int32 p_intFromIndex, Int32 p_intToIndex)
		{
			T tItem = default(T);
			try
			{
				if (p_intFromIndex < m_lstItems.Count)
				{
					m_rwlLock.EnterWriteLock();
					tItem = m_lstItems[p_intFromIndex];
					m_lstItems.RemoveAt(p_intFromIndex);

					if (p_intToIndex >= m_lstItems.Count)
						m_lstItems.Add(tItem);
					else
						m_lstItems.Insert(p_intToIndex, tItem);
				}
			}
			finally
			{
				if (m_rwlLock.IsWriteLockHeld)
					m_rwlLock.ExitWriteLock();
			}
			OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Move, tItem, p_intToIndex, p_intFromIndex));
		}
	}
}
