using System.Collections.Generic;
using Utils;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// Describes an option.
	/// </summary>
	/// <remarks>
	/// This class tracks the name, description, type, and files/folders associated with an option.
	/// </remarks>
	public class Option : ObservableObject
	{
		private string m_strName = null;
		private string m_strDesc = null;
		private string m_strImagePath = null;
		private IOptionTypeResolver m_otrTypeResolver = null;
		private List<InstallableFile> m_lstFiles = null;
		private List<ConditionalFlag> m_lstFlags = null;

		#region Properties

		/// <summary>
		/// Gets or sets the name of the option.
		/// </summary>
		/// <value>The name of the option.</value>
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
		/// Gets or sets the description of the option.
		/// </summary>
		/// <value>The description of the option.</value>
		public string Description
		{
			get
			{
				return m_strDesc;
			}
			set
			{
				SetPropertyIfChanged(ref m_strDesc, value, () => Description);
			}
		}

		/// <summary>
		/// Gets or sets the path to the option image.
		/// </summary>
		/// <value>The path to the option image</value>
		public string ImagePath
		{
			get
			{
				return m_strImagePath;
			}
			set
			{
				SetPropertyIfChanged(ref m_strImagePath, value, () => ImagePath);
			}
		}

		/// <summary>
		/// Gets the list of files and folders associated with the option.
		/// </summary>
		/// <value>The list of files and folders associated with the option.</value>
		public List<InstallableFile> Files
		{
			get
			{
				return m_lstFiles;
			}
		}

		/// <summary>
		/// Gets the list of flags that should be set to the specifid value if the option is in the specified state.
		/// </summary>
		/// <value>The list of flags that should be set to the specifid value if the option is in the specified state.</value>
		public List<ConditionalFlag> Flags
		{
			get
			{
				return m_lstFlags;
			}
		}

		public IOptionTypeResolver OptionTypeResolver
		{
			get
			{
				return m_otrTypeResolver;
			}
			set
			{
				SetPropertyIfChanged(ref m_otrTypeResolver, value ?? new StaticOptionTypeResolver(OptionType.NotUsable), () => OptionTypeResolver);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the values of the object.
		/// </summary>
		/// <param name="p_strName">The name of the option.</param>
		/// <param name="p_strDesc">The description of the option.</param>
		/// <param name="p_imgImage">The path to the option image.</param>
		/// <param name="p_ptpType">The <see cref="OptionType"/> of the option.</param>
		public Option(string p_strName, string p_strDesc, string p_strImagePath, IOptionTypeResolver p_ptpType)
		{
			m_strName = p_strName;
			m_lstFiles = new List<InstallableFile>();
			m_lstFlags = new List<ConditionalFlag>();
			m_otrTypeResolver = p_ptpType ?? new StaticOptionTypeResolver(OptionType.NotUsable);
			m_strDesc = p_strDesc;
			m_strImagePath = p_strImagePath;
		}

        #endregion

        /// <summary>
        /// Gets the <see cref="OptionType"/> of the option.
        /// </summary>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>The <see cref="OptionType"/> of the option.</returns>
        public OptionType GetOptionType(ConditionStateManager csmState, CoreDelegates coreDelegates)
		{
			return m_otrTypeResolver.ResolveOptionType(csmState, coreDelegates);
		}
	}
}
