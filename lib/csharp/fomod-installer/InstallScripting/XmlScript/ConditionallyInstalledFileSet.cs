using System.Collections.Generic;
using Utils;
using Utils.Collections;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// A pattern that is matched against external conditions to determine whether
	/// or not its files are installed.
	/// </summary>
	public class ConditionallyInstalledFileSet : ObservableObject
	{
		private ThreadSafeObservableList<InstallableFile> m_lstFiles = null;
		private ICondition m_cndCondition = null;

		#region Properties

		/// <summary>
		/// Gets the condition that must by fulfilled for this pattern's files to be installed.
		/// </summary>
		/// <value>The condition that must by fulfilled for this pattern's files to be installed.</value>
		public ICondition Condition
		{
			get
			{
				return m_cndCondition;
			}
			set
			{
				m_cndCondition = value;
			}
		}

		/// <summary>
		/// Gets the list of files that are to be installed if the pattern's condition is fulfilled.
		/// </summary>
		/// <value>The list of files that are to be installed if the pattern's condition is fulfilled.</value>
		public IList<InstallableFile> Files
		{
			get
			{
				return m_lstFiles;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_cndCondition">The condition that must by fulfilled for this pattern's files to be installed.</param>
		/// <param name="p_lstFiles">The files that are to be installed if the given condition is fulfilled.</param>
		public ConditionallyInstalledFileSet(ICondition p_cndCondition, IList<InstallableFile> p_lstFiles)
		{
			m_cndCondition = p_cndCondition;
			m_lstFiles = (p_lstFiles == null) ? new ThreadSafeObservableList<InstallableFile>() : new ThreadSafeObservableList<InstallableFile>(p_lstFiles);
			m_lstFiles.CollectionChanged += new System.Collections.Specialized.NotifyCollectionChangedEventHandler(Files_CollectionChanged);
		}

		#endregion

		private void Files_CollectionChanged(object sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
		{
			OnPropertyChanged(() => Files);
		}
	}
}
