using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;

namespace Utils.Collections
{
	/// <summary>
	/// This is a sorted list whose operations are thread safe, and that notifes listeners about changes to the list.
	/// The main difference between this list and others is that all methods that operate over the entire
	/// list, such as <see cref="GetEnumerator()"/>, do so over a snapshot of the list, as opposed
	/// to the list itself.
	/// </summary>
	/// <typeparam name="T">The type of the items in the list.</typeparam>
	public class SortedThreadSafeObservableCollection<T> : ThreadSafeObservableList<T>
	{
		private bool m_booSuppressEvents = false;
		private bool m_booSorting = false;
		private IComparer<T> m_cmpComparer = null;

		#region Properties

		/// <summary>
		/// Sets the <see cref="IComparer"/> used to sort the items.
		/// </summary>
		/// <value>The <see cref="IComparer"/> used to sort the items.</value>
		public IComparer<T> Comparer
		{
			set
			{
				try
				{
					m_rwlLock.EnterWriteLock();
					m_booSuppressEvents = true;
					m_cmpComparer = value;
					if (value != null)
						Sort();
					m_booSuppressEvents = false;
				}
				finally
				{
					if (m_rwlLock.IsWriteLockHeld)
						m_rwlLock.ExitWriteLock();
				}				
				OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public SortedThreadSafeObservableCollection()
			: this(null, null)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list.
		/// </summary>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		public SortedThreadSafeObservableCollection(IEnumerable<T> p_enmItems)
			: this(p_enmItems, null)
		{
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <remarks>
		/// WARNING: The given <see cref="IComparer{T}"/> is only used when adding
		/// items to the list, and when calling <see cref="BinarySearch"/>. Calls to
		/// <see cref="Contains"/> and <see cref="IndexOf"/> do not use the given
		/// comparer.
		/// </remarks>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the sorted list.</param>
		public SortedThreadSafeObservableCollection(IComparer<T> p_cmpComparer)
			: this(null, p_cmpComparer)
		{
		}

		/// <summary>
		/// A constructor that initializs the items of the list, and allows the specification of a custom comparer.
		/// </summary>
		/// <remarks>
		/// WARNING: The given <see cref="IComparer{T}"/> is only used when adding
		/// items to the list, and when calling <see cref="BinarySearch"/>. Calls to
		/// <see cref="Contains"/> and <see cref="IndexOf"/> do not use the given
		/// comparer.
		/// </remarks>
		/// <param name="p_enmItems">The items with which to initialize the list.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the sorted list.</param>
		public SortedThreadSafeObservableCollection(IEnumerable<T> p_enmItems, IComparer<T> p_cmpComparer)
			: base(p_enmItems)
		{
			if (!typeof(IComparable<T>).IsAssignableFrom(typeof(T)) && (p_cmpComparer == null))
				throw new ArgumentException("Type " + typeof(T).Name + " is not IComparable. Use SortedList(IComparer) to supply a comparer.");
			Comparer = p_cmpComparer;
		}

		/// <summary>
		/// The copy constructor.
		/// </summary>
		/// <remarks>
		/// This performs a shallow copy of the given list.
		/// </remarks>
		/// <param name="p_enmItems">The collection to copy.</param>
		public SortedThreadSafeObservableCollection(SortedThreadSafeObservableCollection<T> p_enmItems)
			: this(p_enmItems, p_enmItems.m_cmpComparer)
		{
		}

		#endregion

		/// <summary>
		/// Compares the given items.
		/// </summary>
		/// <param name="x">An object to compare to another object.</param>
		/// <param name="y">An object to compare to another object.</param>
		/// <returns>A value less than 0 if <paramref name="x"/> is less than <paramref name="y"/>.
		/// 0 if this node is equal to the other.
		/// A value greater than 0 if <paramref name="x"/> is greater than <paramref name="y"/>.</returns>
		private Int32 CompareItems(T p_tItem1, T p_tItem2)
		{
			if (m_cmpComparer != null)
				return m_cmpComparer.Compare(p_tItem1, p_tItem2);
			return ((IComparable<T>)p_tItem1).CompareTo(p_tItem2);
		}

		#region Sorting

		/// <summary>
		/// Exchanges the to items in the list.
		/// </summary>
		/// <param name="p_intIndex1">An item to exchange with another item.</param>
		/// <param name="p_intIndex2">An item to exchange with another item.</param>
		private void Swap(Int32 p_intIndex1, Int32 p_intIndex2)
		{
			T tItem = this[p_intIndex1];
			base.SetItem(p_intIndex1, this[p_intIndex2]);
			base.SetItem(p_intIndex2, tItem);
		}

		/// <summary>
		/// Partitions the list while quicksorting.
		/// </summary>
		/// <param name="p_intLeft">The left index of the section of the list to partition.</param>
		/// <param name="p_intRight">The right index of the section of the list to partition.</param></param>
		/// <param name="p_intPivotIndex">The index around wich to partition the section of the list.</param>
		/// <returns>The new pivot index.</returns>
		private Int32 Partition(Int32 p_intLeft, Int32 p_intRight, Int32 p_intPivotIndex)
		{
			T pivotValue = this[p_intPivotIndex];
			Swap(p_intPivotIndex, p_intRight);
			Int32 storeIndex = p_intLeft;
			for (Int32 i = p_intLeft; i < p_intRight; i++)
			{
				if (CompareItems(this[i], pivotValue) < 1)
				{
					Swap(i, storeIndex);
					storeIndex++;
				}
			}
			Swap(storeIndex, p_intRight);
			return storeIndex;
		}

		/// <summary>
		/// Sorts the specified section of the list using the quicksort algorithm.
		/// </summary>
		/// <param name="p_intLeft">The left index of the section of the list to sort.</param>
		/// <param name="p_intRight">The right index of the section of the list to sort.</param></param>
		private void Quicksort(Int32 p_intLeft, Int32 p_intRight)
		{
			if (p_intRight > p_intLeft)
			{
				Int32 pivotIndex = (p_intRight + p_intLeft) / 2;
				Int32 pivotNewIndex = Partition(p_intLeft, p_intRight, pivotIndex);
				Quicksort(p_intLeft, pivotNewIndex - 1);
				Quicksort(pivotNewIndex + 1, p_intRight);
			}
		}

		/// <summary>
		/// Sorts the list.
		/// </summary>
		protected void Sort()
		{
			m_booSuppressEvents = true;
			m_booSorting = true;
			Quicksort(0, Count - 1);
			m_booSorting = false;
			m_booSuppressEvents = false;
		}

		#endregion

		#region Searching

		/// <summary>
		/// Performs a birnary search for the given item in the specified section of the list.
		/// </summary>
		/// <param name="p_tItem">The item to find in the list.</param>
		/// <param name="p_intLeft">The left index of the section of the list to search.</param>
		/// <param name="p_intRight">The right index of the section of the list to search.</param>
		/// <returns>The index of the given item, or a negative number that is the bitwise
		/// complement of the next largest item if the item is not in the sorted list.</returns>
		public Int32 BinarySearch(T p_tItem, Int32 p_intLeft, Int32 p_intRight)
		{
			try
			{
				m_rwlLock.EnterReadLock();
				if (p_intRight < p_intLeft)
					return ~p_intLeft;
				Int32 intMiddleIndex = (p_intRight + p_intLeft) / 2;
				Int32 intResult = CompareItems(p_tItem, this[intMiddleIndex]);
				if (intResult == 0)
					return intMiddleIndex;
				if (intResult < 0)
					return BinarySearch(p_tItem, p_intLeft, intMiddleIndex - 1);
				return BinarySearch(p_tItem, intMiddleIndex + 1, p_intRight);
			}
			finally
			{
				if (m_rwlLock.IsReadLockHeld)
					m_rwlLock.ExitReadLock();
			}
		}

		/// <summary>
		/// Performs a birnary search for the given item in the list.
		/// </summary>
		/// <param name="p_tItem">The item to find in the list.</param>
		/// <returns>The index of the given item, or a negative number that is the bitwise
		/// complement of the next largest item if the item is not in the sorted list.</returns>
		public Int32 BinarySearch(T p_tItem)
		{
			return BinarySearch(p_tItem, 0, Count - 1);
		}

		#endregion

		/// <summary>
		/// Inserts the given item at the given index.
		/// </summary>
		/// <remarks>
		/// Random inserts don't make sense in an ordered list, so inserts are only
		/// allowed if they're as a result of an add operation.
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		/// <exception cref="InvalidOperationException">Thrown if the item isn't being inserted
		/// as a result of an add operation.</exception>
		protected override void InsertItem(int index, T item)
		{
			if (index < Count)
				throw new InvalidOperationException("The method or operation cannot be performed on a Sorted List.");
			Int32 intIndex = BinarySearch(item);
			if (intIndex < 0)
				intIndex = ~intIndex;
			base.InsertItem(intIndex, item);
		}

		/// <summary>
		/// Moves the item from the specified From index to the specified
		/// To index.
		/// </summary>
		/// <param name="p_intFromIndex">The index of the item to move.</param>
		/// <param name="p_intToIndex">The index to which to move the item.</param>
		public override void Move(Int32 p_intFromIndex, Int32 p_intToIndex)
		{
			throw new InvalidOperationException("The method or operation cannot be performed on a Sorted List.");
		}

		/// <summary>
		/// Sets the specified index to the given item.
		/// </summary>
		/// <remarks>
		/// This operation does not make sense in a set, so this method
		/// always throws an <see cref="InvalidOperationException"/>,
		/// unless it is being called as the result of an internal sorting call.
		/// </remarks>
		/// <param name="index">The index at which to set the item.</param>
		/// <param name="item">The item to set.</param>
		/// <exception cref="InvalidOperationException">Thrown always,
		/// unless the method is being called as the result of an internal sorting call..</exception>
		protected override void SetItem(int index, T item)
		{
			if (m_booSorting)
				base.SetItem(index, item);
			else
				throw new InvalidOperationException("The method or operation cannot be performed on an Ordered List.");
		}

		#region Event Raising

		/// <summary>
		/// Raises the <see cref="CollectionChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		protected override void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
		{
			if (!m_booSuppressEvents)
				base.OnCollectionChanged(e);
		}

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		protected override void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			if (!m_booSuppressEvents)
				base.OnPropertyChanged(e);
		}

		#endregion
	}
}
