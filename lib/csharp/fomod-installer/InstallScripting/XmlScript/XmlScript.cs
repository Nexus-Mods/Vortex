using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using FomodInstaller.Scripting;
using Utils;
using Utils.Collections;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// Represents an XML script.
	/// </summary>
	public class XmlScript : ObservableObject, IScript
	{
		/// <summary>
		/// Compares to <see cref="InstallStep"/>s.
		/// </summary>
		/// <remarks>
		/// The <see cref="InstallStep"/>s are compared using their
		/// <see cref="InstallStep.Name"/>s.
		/// </remarks>
		private class InstallStepComparer : StringComparer<InstallStep>
		{
			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_sodOrder">The order in which to compare the items.</param>
			public InstallStepComparer(SortOrder p_sodOrder)
				: base(p_sodOrder)
			{
			}

			#endregion
			
			/// <summary>
			/// Compares the given <see cref="InstallStep"/>s.
			/// </summary>
			/// <remarks>
			/// The <see cref="InstallStep.Name"/>s are compared.
			/// </remarks>
			/// <param name="x">An object to compare to another object.</param>
			/// <param name="y">An object to compare to another object.</param>
			/// <returns>A value less than 0 if <paramref name="x"/> is less than <paramref name="y"/>.
			/// 0 if this node is equal to the other.
			/// A value greater than 0 if <paramref name="x"/> is greater than <paramref name="y"/>.</returns>
			public override int Compare(InstallStep x, InstallStep y)
			{
				return StringCompare(x.Name, y.Name);
			}
		}

		private SortOrder m_srtStepOrder = SortOrder.Explicit;
		private Version m_verVersion = null;
		private ICondition m_cndModPrerequisites = null;

		#region Properties

		/// <summary>
		/// Gets or sets the order of the script's <see cref="InstallStep"/>s.
		/// </summary>
		/// <value>The order of the script's <see cref="InstallStep"/>s.</value>
		public SortOrder InstallStepSortOrder
		{
			get
			{
				return m_srtStepOrder;
			}
			set
			{
				if (SetPropertyIfChanged(ref m_srtStepOrder, value, () => InstallStepSortOrder))
				{
					InstallSteps.CollectionChanged -= InstallSteps_CollectionChanged;
					switch (m_srtStepOrder)
					{
						case SortOrder.Explicit:
							InstallSteps = new ThreadSafeObservableList<InstallStep>(InstallSteps);
							break;
						default:
							InstallSteps = new SortedThreadSafeObservableCollection<InstallStep>(InstallSteps, new InstallStepComparer(m_srtStepOrder));
							break;
					}
					InstallSteps.CollectionChanged += new NotifyCollectionChangedEventHandler(InstallSteps_CollectionChanged);
					OnPropertyChanged(() => InstallSteps);
				}
			}
		}		

		/// <summary>
		/// Gets or sets the version of the script.
		/// </summary>
		/// <value>The version of the script.</value>
		public Version Version
		{
			get
			{
				return m_verVersion;
			}
			set
			{
				SetPropertyIfChanged(ref m_verVersion, value, () => Version);
			}
		}

		/// <summary>
		/// Gets the <see cref="HeaderInfo"/> of the script.
		/// </summary>
		/// <value>The <see cref="HeaderInfo"/> of the script.</value>
		public HeaderInfo HeaderInfo { get; private set; }

		/// <summary>
		/// Gets or sets the mod prerequisites encoded in the script.
		/// </summary>
		/// <value>The mod prerequisites encoded in the script.</value>
		public ICondition ModPrerequisites
		{
			get
			{
				return m_cndModPrerequisites;
			}
			set
			{
				SetPropertyIfChanged(ref m_cndModPrerequisites, value, () => ModPrerequisites);
			}
		}

		/// <summary>
		/// Gets the script's <see cref="InstallStep"/>s.
		/// </summary>
		/// <value>The script's <see cref="InstallStep"/>s.</value>
		public ThreadSafeObservableList<InstallStep> InstallSteps { get; private set; }

		/// <summary>
		/// Gets the list of files that the script requires to be installed, regardless
		/// of other script options.
		/// </summary>
		/// <value>The list of files that the script requires to be installed, regardless
		/// of other script options.</value>
		public ThreadSafeObservableList<InstallableFile> RequiredInstallFiles { get; private set; }

		/// <summary>
		/// Gets the list of file sets that the script wants installed if certain conditions
		/// are satified.
		/// </summary>
		/// <value>The list of file sets that the script wants installed if certain conditions
		/// are satified.</value>
		public ThreadSafeObservableList<ConditionallyInstalledFileSet> ConditionallyInstalledFileSets { get; private set; }

		#endregion

		#region IScript Members

		/// <summary>
		/// Gets the type of the script.
		/// </summary>
		/// <value>The type of the script.</value>
		public IScriptType Type { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the script with the specified values.
		/// </summary>
		/// <param name="p_xstScripType">The script's type.</param>
		/// <param name="p_verVersion">The version of the script.</param>
		public XmlScript(XmlScriptType p_xstScripType, Version p_verVersion)
			: this(p_xstScripType, p_verVersion, new HeaderInfo(), null, null, null, SortOrder.Explicit, null)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the script with the specified values.
		/// </summary>
		/// <param name="p_xstScripType">The script's type.</param>
		/// <param name="p_verVersion">The version of the script.</param>
		/// <param name="p_hdrHeader">The <see cref="HeaderInfo"/> of the script.</param>
		/// <param name="p_cndModPrerequisites">The mod prerequisites encoded in the script.</param>
		/// <param name="p_lstRequiredInstallFiles">The list of files that the script requires to be installed, regardless
		/// of other script options.</param>
		/// <param name="p_lstInstallSteps">The script's <see cref="InstallStep"/>s.</param>
		/// <param name="p_srtStepOrder">The order of the script's <see cref="InstallStep"/>s.</param>
		/// <param name="p_lstConditionallyInstalledFileSets">The list of file sets that the script wants installed if certain conditions
		/// are satified.</param>
		public XmlScript(XmlScriptType p_xstScripType, Version p_verVersion, HeaderInfo p_hdrHeader, ICondition p_cndModPrerequisites, IList<InstallableFile> p_lstRequiredInstallFiles, List<InstallStep> p_lstInstallSteps, SortOrder p_srtStepOrder, List<ConditionallyInstalledFileSet> p_lstConditionallyInstalledFileSets)
		{
			Type = p_xstScripType;
			Version = p_verVersion;
			HeaderInfo = p_hdrHeader;
			ModPrerequisites = p_cndModPrerequisites;
			RequiredInstallFiles = (p_lstRequiredInstallFiles == null) ? new ThreadSafeObservableList<InstallableFile>() : new ThreadSafeObservableList<InstallableFile>(p_lstRequiredInstallFiles);
			InstallSteps = (p_lstInstallSteps == null) ? new ThreadSafeObservableList<InstallStep>() : new ThreadSafeObservableList<InstallStep>(p_lstInstallSteps);
			InstallSteps.CollectionChanged += new NotifyCollectionChangedEventHandler(InstallSteps_CollectionChanged);
			InstallStepSortOrder = p_srtStepOrder;
			ConditionallyInstalledFileSets = (p_lstConditionallyInstalledFileSets == null) ? new ThreadSafeObservableList<ConditionallyInstalledFileSet>() : new ThreadSafeObservableList<ConditionallyInstalledFileSet>(p_lstConditionallyInstalledFileSets);
		}

		#endregion

		/// <summary>
		/// Handles the <see cref="ThreadSafeObservableList.CollectionChanged"/> event of the <see cref="InstallSteps"/>
		/// collection.
		/// </summary>
		/// <remarks>
		/// This raises the <see cref="INotifyPropertyChanged.PropertyChanged"/> event for the <see cref="InstallSteps"/>
		/// property.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="NotifyCollectionChangedEventArgs"/> describing the event arguments.</param>
		private void InstallSteps_CollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
		{
			OnPropertyChanged(() => InstallSteps);
		}

		
	}
}
