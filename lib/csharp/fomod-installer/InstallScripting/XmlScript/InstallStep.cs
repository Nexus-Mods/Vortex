using System.Collections.Generic;
using System.Collections.Specialized;
using Utils;
using Utils.Collections;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// A step in the XML Script install of a mod.
	/// </summary>
	public class InstallStep : ObservableObject
	{
		private class OptionGroupComparer : StringComparer<OptionGroup>
		{
			public OptionGroupComparer(SortOrder p_sodOrder)
				: base(p_sodOrder)
			{
			}

			public override int Compare(OptionGroup x, OptionGroup y)
			{
				return StringCompare(x.Name, y.Name);
			}
		}

		private string m_strName = null;
		private ThreadSafeObservableList<OptionGroup> m_lstGroupedOptions = new ThreadSafeObservableList<OptionGroup>();
		private SortOrder m_srtGroupOrder = SortOrder.Explicit;

		#region Properties

		/// <summary>
		/// Gets or sets the visibility condition.
		/// </summary>
		/// <remarks>
		/// This condition determines whether or not the install step is display in the setup wizard.
		/// </remarks>
		/// <value>The visibility condition.</value>
		public ICondition VisibilityCondition { get; set; }

		/// <summary>
		/// Gets the name of the step.
		/// </summary>
		/// <value>The name of the step.</value>
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

		public SortOrder GroupSortOrder
		{
			get
			{
				return m_srtGroupOrder;
			}
			set
			{
				if (SetPropertyIfChanged(ref m_srtGroupOrder, value, () => GroupSortOrder))
				{
					m_lstGroupedOptions.CollectionChanged -= OptionGroups_CollectionChanged;
					switch (m_srtGroupOrder)
					{
						case SortOrder.Explicit:
							m_lstGroupedOptions = new ThreadSafeObservableList<OptionGroup>(m_lstGroupedOptions);
							break;
						default:
							m_lstGroupedOptions = new SortedThreadSafeObservableCollection<OptionGroup>(m_lstGroupedOptions, new OptionGroupComparer(m_srtGroupOrder));
							break;
					}
					m_lstGroupedOptions.CollectionChanged += new NotifyCollectionChangedEventHandler(OptionGroups_CollectionChanged);
					OnPropertyChanged(() => OptionGroups);
				}
			}
		}

		/// <summary>
		/// Gets the grouped list of plugins to display in this step.
		/// </summary>
		/// <value>The grouped list of plugins to display in this step.</value>
		public IList<OptionGroup> OptionGroups
		{
			get
			{
				return m_lstGroupedOptions;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the install step.</param>
		/// <param name="p_cpcVisibilityDependency">The <see cref="ICondition"/> that determines the visibility of this step.</param>
		public InstallStep(string p_strName, ICondition p_cndVisibilityCondition, SortOrder p_srtGroupOrder)
		{
			m_strName = p_strName;
			VisibilityCondition = p_cndVisibilityCondition;
			GroupSortOrder = p_srtGroupOrder;
			m_lstGroupedOptions.CollectionChanged += new NotifyCollectionChangedEventHandler(OptionGroups_CollectionChanged);
		}

		#endregion

		/// <summary>
		/// Handles the <see cref="ThreadSafeObservableList.CollectionChanged"/> event of the <see cref="OptionGroups"/>
		/// collection.
		/// </summary>
		/// <remarks>
		/// This raises the <see cref="INotifyPropertyChanged.PropertyChanged"/> event for the <see cref="OptionGroups"/>
		/// property.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		private void OptionGroups_CollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
		{
			OnPropertyChanged(() => OptionGroups);
		}

        /// <summary>
        /// Gets whether this step is visible.
        /// </summary>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns><c>true</c> if this step is visible, given the current state;
        /// <c>false</c> otherwise.</returns>
        public bool GetIsVisible(ConditionStateManager csmState, CoreDelegates coreDelegates)
		{
			if (VisibilityCondition == null)
				return true;
			return VisibilityCondition.GetIsFulfilled(csmState, coreDelegates);
		}
	}
}
