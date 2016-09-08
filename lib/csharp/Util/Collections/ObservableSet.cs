using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;

namespace Util.Collections
{
	/// <summary>
	/// A Set implementation that provides notifications when items are added or removed.
	/// </summary>
	/// <typeparam name="T">The type of objects in the Set.</typeparam>
	public class ObservableSet<T> : Set<T>, INotifyCollectionChanged, INotifyPropertyChanged
	{
		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ObservableSet()
		{
		}

		/// <summary>
		/// A constructor that fills the set with the given items.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the set.</param>
		public ObservableSet(IEnumerable<T> p_enmItems)
			: base(p_enmItems)
		{
		}

		/// <summary>
		/// A constructor that fills the set with the given items, and allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_enmItems">the items to add to the set.</param>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the set.</param>
		public ObservableSet(IEnumerable<T> p_enmItems, IComparer<T> p_cmpComparer)
			: base(p_enmItems, p_cmpComparer)
		{
		}

		/// <summary>
		/// A constructor that allows the specification of a custom comparer.
		/// </summary>
		/// <param name="p_cmpComparer">The comparer to use when determining if an item is already in the set.</param>
		public ObservableSet(IComparer<T> p_cmpComparer)
			: base(p_cmpComparer)
		{
		}

		/// <summary>
		/// The copy constructor.
		/// </summary>
		/// <param name="p_setCopy">The set to copy.</param>
		public ObservableSet(Set<T> p_setCopy)
			: base(p_setCopy)
		{
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
		protected event PropertyChangedEventHandler PropertyChanged = delegate { };

		/// <summary>
		/// Raised when a property of the collection changes.
		/// </summary>
		event PropertyChangedEventHandler INotifyPropertyChanged.PropertyChanged
		{
			add
			{
				PropertyChanged += value;
			}
			remove
			{
				PropertyChanged -= value;
			}
		}

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
		/// Adds the given item to the set.
		/// </summary>
		/// <param name="p_tItem">The item to add.</param>
		public override void Add(T p_tItem)
		{
			if (!Contains(p_tItem))
			{
				base.Add(p_tItem);
				OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, p_tItem));
				PropertyChanged(this, new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
			}
		}

		/// <summary>
		/// Empties the set.
		/// </summary>
		public override void Clear()
		{
			if (Count > 0)
			{
				base.Clear();
				OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
				PropertyChanged(this, new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
			}
		}

		/// <summary>
		/// Removes the item form the set at the given index.
		/// </summary>
		/// <param name="index">The index of the item to remove from the set.</param>
		public override void RemoveAt(int index)
		{
			T tItem = this[index];
			base.RemoveAt(index);
			OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Remove, tItem, index));
			PropertyChanged(this, new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Count)));
		}
	}
}
