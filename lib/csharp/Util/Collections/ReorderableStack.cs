using System;
using System.Collections;
using System.Collections.Generic;

namespace Util.Collections
{
	/// <summary>
	/// Implements a stack whose items can be reordered.
	/// </summary>
	/// <typeparam name="T">The type of objects in the stack.</typeparam>
	public class ReorderableStack<T> : IList<T>
	{
		private List<T> m_lstItems = null;
		private IEqualityComparer<T> m_cmpComparer = null;
		private Comparison<T> m_cmpComparison = null;

		#region Properties

		/// <summary>
		/// Gets the comparer used to compare items in the stack.
		/// </summary>
		/// <remarks>
		/// This value is <c>null</c> if a custom comparer is not being used.
		/// </remarks>
		/// <value>The comparer used to compare items in the stack.</value>
		protected IEqualityComparer<T> Comparer
		{
			get
			{
				return m_cmpComparer;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ReorderableStack()
		{
			m_lstItems = new List<T>();
		}

		/// <summary>
		/// Initializes the stack with the given items.
		/// </summary>
		/// <param name="p_enmItem">The items with which to initialize the stack.</param>
		public ReorderableStack(IEnumerable<T> p_enmItem)
		{
			m_lstItems = new List<T>(p_enmItem);
		}


		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the stack.</param>
		public ReorderableStack(IEqualityComparer<T> p_cmpComparer)
			: this()
		{
			m_cmpComparer = p_cmpComparer;
		}

		/// <summary>
		/// A constructor that fills the stack with the given items, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the stack.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the stack.</param>
		public ReorderableStack(IEnumerable<T> p_enmItems, IEqualityComparer<T> p_cmpComparer)
			: this(p_enmItems)
		{
			m_cmpComparer = p_cmpComparer;
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the stack.</param>
		public ReorderableStack(Comparison<T> p_cmpComparison)
			: this()
		{
			m_cmpComparison = p_cmpComparison;
		}

		/// <summary>
		/// A constructor that fills the stack with the given items, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the stack.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the stack.</param>
		public ReorderableStack(IEnumerable<T> p_enmItems, Comparison<T> p_cmpComparison)
			: this(p_enmItems)
		{
			m_cmpComparison = p_cmpComparison;
		}

		#endregion

		#region Stack Methods

		/// <summary>
		/// Returns the item on the top of the stack without removing it.
		/// </summary>
		/// <returns>The item at the top of the stack.</returns>
		public T Peek()
		{
			return m_lstItems[m_lstItems.Count - 1];
		}

		/// <summary>
		/// Removes the item on the top of the stack are returns it.
		/// </summary>
		/// <returns>The item at the top of the stack.</returns>
		public T Pop()
		{
			T tItem = Peek();
			m_lstItems.RemoveAt(m_lstItems.Count - 1);
			return tItem;
		}

		/// <summary>
		/// Adds an item to the top of the stack.
		/// </summary>
		/// <param name="item">The item to add to the stack.</param>
		public void Push(T item)
		{
			m_lstItems.Add(item);
		}

		/// <summary>
		/// Adds the given items to the top of the stack.
		/// </summary>
		/// <remarks>
		/// The given enumeration is treated as a FIFO list. The first item
		/// is pushed first, the last item is pushed last.
		/// </remarks>
		/// <param name="p_enmItems">The items to add.</param>
		public void PushRange(IEnumerable<T> p_enmItems)
		{
			foreach (T tItem in p_enmItems)
				Push(tItem);
		}

		#endregion

		#region IList<T> Members

		/// <summary>
		/// Determines the first index of the specified item.
		/// </summary>
		/// <param name="p_tItem">The item whose index in the stack is to be found.</param>
		/// <returns>The first index of the specified item, or -1 if the item is not in the stack.</returns>
		public int IndexOf(T p_tItem)
		{
			if (m_cmpComparer != null)
			{
				for (Int32 i = 0; i < this.Count; i++)
					if (m_cmpComparer.Equals(this[i], p_tItem))
						return i;
				return -1;
			}
			if (m_cmpComparison != null)
			{
				for (Int32 i = 0; i < this.Count; i++)
					if (m_cmpComparison(this[i], p_tItem) == 0)
						return i;
				return -1;
			}
			return m_lstItems.IndexOf(p_tItem);
		}

		/// <summary>
		/// Inserts the given item at the specifed index. Cannot be used with a stack.
		/// </summary>
		/// <remarks>
		/// This operation doesn't make sense in a stack.
		///   -> Which means IList was the wrong choice as the interface...
		/// </remarks>
		/// <param name="index">The index at which to insert the item.</param>
		/// <param name="item">The item to insert.</param>
		public void Insert(int index, T item)
		{
			m_lstItems.Insert(index, item);
		}

		/// <summary>
		/// Removes the item form the stack at the given index.
		/// </summary>
		/// <param name="index">The index of the item to remove from the stack.</param>
		public void RemoveAt(int index)
		{
			m_lstItems.RemoveAt(index);
		}

		/// <summary>
		/// Gets or sets the item ate the specified index.
		/// </summary>
		/// <param name="index">The index of the item to get or set.</param>
		/// <returns>Nothing.</returns>
		public T this[int index]
		{
			get
			{
				return m_lstItems[index];
			}
			set
			{
				m_lstItems[index] = value;
			}
		}

		#endregion

		#region ICollection<T> Members

		/// <summary>
		/// Pushed the given item to the stack.
		/// </summary>
		/// <param name="p_tItem">The item to push.</param>
		public void Add(T p_tItem)
		{
			Push(p_tItem);
		}

		/// <summary>
		/// Empties the stack.
		/// </summary>
		public void Clear()
		{
			m_lstItems.Clear();
		}

		/// <summary>
		/// Determines if the given item is in the stack.
		/// </summary>
		/// <param name="p_tItem">The item to look for in the stack.</param>
		/// <returns><c>true</c> if the item is in the stack;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(T p_tItem)
		{
			return IndexOf(p_tItem) > -1;
		}

		/// <summary>
		/// Copies the contents of the stack to the given array, starting at the given index.
		/// </summary>
		/// <param name="array">The array into which to copy the items.</param>
		/// <param name="arrayIndex">The index in the array at which to start copying the items.</param>
		public void CopyTo(T[] array, int arrayIndex)
		{
			m_lstItems.CopyTo(array, arrayIndex);
		}

		/// <summary>
		/// Gets the number of items in the stack.
		/// </summary>
		/// <value>The number of items in the stack.</value>
		public int Count
		{
			get
			{
				return m_lstItems.Count;
			}
		}

		/// <summary>
		/// Gets whether the stack is read-only. Always <c>false</c>.
		/// </summary>
		/// <value>Whether the stack is read-only. Always <c>false</c>.</value>
		public bool IsReadOnly
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Removes the given item from the stack.
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
		/// Gets an enumerator for this items in the stack.
		/// </summary>
		/// <returns>An enumerator for this items in the stack.</returns>
		public IEnumerator<T> GetEnumerator()
		{
			return m_lstItems.GetEnumerator();
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for this items in the stack.
		/// </summary>
		/// <returns>An enumerator for this items in the stack.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable)m_lstItems).GetEnumerator();
		}

		#endregion
	}
}
