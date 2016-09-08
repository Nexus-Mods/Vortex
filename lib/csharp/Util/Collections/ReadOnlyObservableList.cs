using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;

namespace Util.Collections
{
	/// <summary>
	/// A wrapper for a list that implements <see cref="INotifyCollectionChanged"/> and
	/// <see cref="INotifyPropertyChanged"/>, exposing the wrapped list as read-only.
	/// </summary>
	/// <typeparam name="T"></typeparam>
	public class ReadOnlyObservableList<T> : IList<T>, INotifyCollectionChanged, INotifyPropertyChanged
	{
		private IList<T> m_lstItems = null;

		#region Constructors

		/// <summary>
		/// Initializes the read-only list with the list that is to be wrapped.
		/// </summary>
		/// <param name="p_lstList">The list to wrap in a read-only list. The given list must implement
		/// <see cref="INotifyCollectionChanged"/> and <see cref="INotifyPropertyChanged"/>.</param>
		/// <exception cref="ArgumentException">Thrown if the given list does not implement
		/// <see cref="INotifyCollectionChanged"/> and <see cref="INotifyPropertyChanged"/>.</exception>
		public ReadOnlyObservableList(IList<T> p_lstList)
		{
			if (!(p_lstList is INotifyCollectionChanged))
				throw new ArgumentException("The given list must implement INotifyCollectionChanged.", "p_lstList");
			if (!(p_lstList is INotifyPropertyChanged))
				throw new ArgumentException("The given list must implement INotifyPropertyChanged.", "p_lstList");
			m_lstItems = p_lstList;
			((INotifyCollectionChanged)p_lstList).CollectionChanged += new NotifyCollectionChangedEventHandler(ReadOnlyObservableList_CollectionChanged);
			((INotifyPropertyChanged)p_lstList).PropertyChanged += new PropertyChangedEventHandler(ReadOnlyObservableList_PropertyChanged);
		}

		#endregion

		#region IList<T> Members

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the set is to be found.</param>
		/// <returns>The first index of the specified item, or -1 if the item is not in the set.</returns>
		public Int32 IndexOf(T item)
		{
			return m_lstItems.IndexOf(item);
		}

		/// <summary>
		/// Inserts the given item at the specifed index. Cannot be used with a set.
		/// </summary>
		/// <remarks>
		/// This operation cannot be performed on a read-only list.
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		/// <exception cref="NotSupportedException">Thrown always.</exception>
		public void Insert(int index, T item)
		{
			throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
		}

		/// <summary>
		/// Removes the item form the set at the given index.
		/// </summary>
		/// <remarks>
		/// This operation cannot be performed on a read-only list.
		/// </remarks>
		/// <param name="index">The index of the item to remove from the set.</param>
		/// <exception cref="NotSupportedException">Thrown always.</exception>
		public void RemoveAt(int index)
		{
			throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
		}

		/// <summary>
		/// Gets the item ate the specified index.
		/// </summary>
		/// <param name="index">The index of the item to get.</param>
		/// <returns>The requrested item.</returns>
		public T this[int index]
		{
			get
			{
				return m_lstItems[index];
			}
			set
			{
				throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
			}
		}

		#endregion

		#region ICollection<T> Members

		/// <summary>
		/// Adds the given item to the set.
		/// </summary>
		/// <remarks>
		/// This operation cannot be performed on a read-only list.
		/// </remarks>
		/// <param name="p_tItem">The item to add.</param>
		/// <exception cref="NotSupportedException">Thrown always.</exception>
		public void Add(T item)
		{
			throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
		}

		/// <summary>
		/// Empties the set.
		/// </summary>
		/// <remarks>
		/// This operation cannot be performed on a read-only list.
		/// </remarks>
		/// <exception cref="NotSupportedException">Thrown always.</exception>
		public void Clear()
		{
			throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
		}

		/// <summary>
		/// Determines if the given item is in the set.
		/// </summary>
		/// <param name="p_tItem">The item to look for in the set.</param>
		/// <returns><c>true</c> if the item is in the set;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(T item)
		{
			return m_lstItems.Contains(item);
		}

		/// <summary>
		/// Copies the contents of the set to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="arrayIndex">The index in the array at which to start copying the items.</param>
		public void CopyTo(T[] array, int arrayIndex)
		{
			m_lstItems.CopyTo(array, arrayIndex);
		}

		/// <summary>
		/// Gets the number of items in the set.
		/// </summary>
		/// <value>The number of items in the set.</value>
		public int Count
		{
			get
			{
				return m_lstItems.Count;
			}
		}

		/// <summary>
		/// Gets whether the set is read-only. Always <c>true</c>.
		/// </summary>
		/// <value>Whether the set is read-only. Always <c>true</c>.</value>
		public bool IsReadOnly
		{
			get
			{
				return true;
			}
		}

		/// <summary>
		/// Removes the given item from the set.
		/// </summary>
		/// <remarks>
		/// This operation cannot be performed on a read-only list.
		/// </remarks>
		/// <param name="p_tItem">The item to remove</param>
		/// <returns><c>true</c> if the item was removed;
		/// <c>false</c> otherwise.</returns>
		/// <exception cref="NotSupportedException">Thrown always.</exception>
		public bool Remove(T item)
		{
			throw new NotSupportedException("The method or operation cannot be performed on a Read Only List.");
		}

		#endregion

		#region IEnumerable<T> Members

		/// <summary>
		/// Gets an enumerator for this items in the set.
		/// </summary>
		/// <returns>An enumerator for this items in the set.</returns>
		public IEnumerator<T> GetEnumerator()
		{
			return m_lstItems.GetEnumerator();
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for this items in the set.
		/// </summary>
		/// <returns>An enumerator for this items in the set.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable)m_lstItems).GetEnumerator();
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

		/// <summary>
		/// Raises the <see cref="CollectionChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		protected void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
		{
			CollectionChanged(this, e);
		}

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		protected void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			PropertyChanged(this, e);
		}
		
		/// <summary>
		/// Handles the <see cref="INotifyPropertyChanged.PropertyChanged"/> event of the wrapped
		/// list.
		/// </summary>
		/// <remarks>
		/// This raises the <see cref="PropertyChanged"/>, thus bubbling the event up from the wrapped list.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		private void ReadOnlyObservableList_PropertyChanged(object sender, PropertyChangedEventArgs e)
		{
			OnPropertyChanged(e);
		}

		/// <summary>
		/// Handles the <see cref="INotifyCollectionChanged.CollectionChanged"/> event of the wrapped
		/// list.
		/// </summary>
		/// <remarks>
		/// This raises the <see cref="CollectionChanged"/>, thus bubbling the event up from the wrapped list.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		private void ReadOnlyObservableList_CollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
		{
			OnCollectionChanged(e);
		}
	}
}
