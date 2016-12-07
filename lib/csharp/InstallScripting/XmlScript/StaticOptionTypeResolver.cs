using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// An option type that doesn't change.
	/// </summary>
	public class StaticOptionTypeResolver : IOptionTypeResolver
	{
		private OptionType m_ptpType = OptionType.NotUsable;

		#region Properties

		/// <summary>
		/// Gets or sets the option type this pattern returns if it is fulfilled.
		/// </summary>
		/// <value>The option type this pattern returns if it is fulfilled.</value>
		public OptionType Type
		{
			get
			{
				return m_ptpType;
			}
			set
			{
				m_ptpType = value;
			}
		}

		#endregion

		#region Constructor

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_ptpType">The option type.</param>
		public StaticOptionTypeResolver(OptionType p_ptpType)
		{
			m_ptpType = p_ptpType;
		}

		#endregion

		#region IOptionType Members

		/// <summary>
		/// Gets the option type.
		/// </summary>
		/// <returns>The option type.</returns>
		/// <seealso cref="IOptionType.GetOptionType(ConditionStateManager)"/>
		public OptionType ResolveOptionType(ConditionStateManager p_csmStateManager)
		{
			return m_ptpType;
		}

		#endregion
	}
}
