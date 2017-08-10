using System.Collections.Specialized;
using Utils;
using Utils.Collections;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// The possible option group types.
	/// </summary>
	public enum OptionGroupType
	{
		/// <summary>
		/// At least one option in the group must be selected.
		/// </summary>
		SelectAtLeastOne,

		/// <summary>
		/// At most one option in the group must be selected.
		/// </summary>
		SelectAtMostOne,

		/// <summary>
		/// Exactly one option in the group must be selected.
		/// </summary>
		SelectExactlyOne,

		/// <summary>
		/// All options in the group must be selected.
		/// </summary>
		SelectAll,

		/// <summary>
		/// Any number of options in the group may be selected.
		/// </summary>
		SelectAny
	}

	/// <summary>
	/// Represents a group of options.
	/// </summary>
	public class OptionGroup : ObservableObject
	{
		private class OptionComparer : StringComparer<Option>
		{
			public OptionComparer(SortOrder p_sodOrder)
				: base(p_sodOrder)
			{
			}

			public override int Compare(Option x, Option y)
			{
				return StringCompare(x.Name, y.Name);
			}
		}

		private ThreadSafeObservableList<Option> m_lstOptions = new ThreadSafeObservableList<Option>();
		private SortOrder m_srtOptionOrder = SortOrder.Explicit;
		private string m_strName = null;
		private OptionGroupType m_gtpType = OptionGroupType.SelectAtLeastOne;

		#region Properties

		/// <summary>
		/// Gets or sets the name of the group.
		/// </summary>
		/// <value>The name of the group.</value>
		public string Name
		{
			get
			{
				return m_strName;
			}
			set
			{
				SetPropertyIfChanged(ref m_strName, value, () => Name);
			}
		}

		/// <summary>
		/// Gets or sets the type of the group.
		/// </summary>
		/// <value>The type of the group.</value>
		public OptionGroupType Type
		{
			get
			{
				return m_gtpType;
			}
			set
			{
				SetPropertyIfChanged(ref m_gtpType, value, () => Type);
			}
		}

		public SortOrder OptionSortOrder
		{
			get
			{
				return m_srtOptionOrder;
			}
			set
			{
				if (SetPropertyIfChanged(ref m_srtOptionOrder, value, () => OptionSortOrder))
				{
					m_lstOptions.CollectionChanged -= Options_CollectionChanged;
					switch (m_srtOptionOrder)
					{
						case SortOrder.Explicit:
							m_lstOptions = new ThreadSafeObservableList<Option>(m_lstOptions);
							break;
						default:
							m_lstOptions = new SortedThreadSafeObservableCollection<Option>(m_lstOptions, new OptionComparer(m_srtOptionOrder));
							break;
					}
					m_lstOptions.CollectionChanged += new NotifyCollectionChangedEventHandler(Options_CollectionChanged);
					OnPropertyChanged(() => Options);
				}
			}
		}

		/// <summary>
		/// Gets the options that are part of this group.
		/// </summary>
		/// <value>The options that are part of this group.</value>
		public ThreadSafeObservableList<Option> Options
		{
			get
			{
				return m_lstOptions;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the group.</param>
		/// <param name="p_gtpType">The options that are part of this group.</param>
		/// <param name="p_srtOptionOrder">the order by which to sort the options in this group.</param>
		public OptionGroup(string p_strName, OptionGroupType p_gtpType, SortOrder p_srtOptionOrder)
		{
			Name = p_strName;
			Type = p_gtpType;
			OptionSortOrder = p_srtOptionOrder;
			m_lstOptions.CollectionChanged += new NotifyCollectionChangedEventHandler(Options_CollectionChanged);
		}

		#endregion

		/// <summary>
		/// Handles the <see cref="ThreadSafeObservableList.CollectionChanged"/> event of the <see cref="Options"/>
		/// collection.
		/// </summary>
		/// <remarks>
		/// This raises the <see cref="INotifyPropertyChanged.PropertyChanged"/> event for the <see cref="Options"/>
		/// property.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		private void Options_CollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
		{
			OnPropertyChanged(() => Options);
		}
	}
}
