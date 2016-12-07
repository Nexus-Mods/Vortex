using System;
using System.Collections.Generic;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// An option type that is dependent upon the state of external conditions.
	/// </summary>
	public class ConditionalOptionTypeResolver : IOptionTypeResolver
	{
		/// <summary>
		/// A pattern that is matched against external conditions to determine whether
		/// or not its option type is elected.
		/// </summary>
		public class ConditionalTypePattern
		{
			private OptionType m_ptpType = OptionType.NotUsable;
			private ICondition m_cndCondition = null;

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

			/// <summary>
			/// Gets or sets the condition that must by fulfilled for this pattern's option type
			/// to be elected.
			/// </summary>
			/// <value>The condition that must by fulfilled for this pattern's option type
			/// to be elected.</value>
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

			#endregion

			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_ptpType">The option type this pattern returns if it is fulfilled.</param>
			/// <param name="p_cndCondition">The condition that must by fulfilled for this pattern's option type
			/// to be elected.</param>
			public ConditionalTypePattern(OptionType p_ptpType, ICondition p_cndCondition)
			{
				m_ptpType = p_ptpType;
				m_cndCondition = p_cndCondition;
			}

			#endregion
		}

		private OptionType m_ptpDefaultType = OptionType.NotUsable;
		private List<ConditionalTypePattern> m_lstPatterns = new List<ConditionalTypePattern>();

		#region Properties

		/// <summary>
		/// Gets or sets the default type.
		/// </summary>
		/// <remarks>
		/// The default type is returned if none of the <see cref="ConditionalTypePatterns"/>
		/// are matched.
		/// </remarks>
		/// <value>The default type.</value>
		public OptionType DefaultType
		{
			get
			{
				return m_ptpDefaultType;
			}
			set
			{
				m_ptpDefaultType = value;
			}
		}

		/// <summary>
		/// Gets the list of conditional patterns that are used to determine the type.
		/// </summary>
		/// <value>The list of conditional patterns that are used to determine the type.</value>
		public List<ConditionalTypePattern> ConditionalTypePatterns
		{
			get
			{
				return m_lstPatterns;
			}
		}


		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_ptpDefaultType">The default <see cref="OptionType"/> to return
		/// if no patterns are fulfilled.</param>
		public ConditionalOptionTypeResolver(OptionType p_ptpDefaultType)
		{
			m_ptpDefaultType = p_ptpDefaultType;
		}

		#endregion

		/// <summary>
		/// Adds a pattern that returns the given option type if the given condition is fulfilled.
		/// </summary>
		/// <param name="p_ptpType">The type the pattern will return if the condition is fulfilled.</param>
		/// <param name="p_cndCondition">The condition that must be fulfilled in order for the pattern
		/// to return the option type.</param>
		public void AddPattern(OptionType p_ptpType, ICondition p_cndCondition)
		{
			m_lstPatterns.Add(new ConditionalTypePattern(p_ptpType, p_cndCondition));
		}

		#region IOptionTypeResolver Members

		/// <summary>
		/// Gets the plugin type.
		/// </summary>
		/// <remarks>
		/// The returned type is dependent upon external state. A list of patterns are matched
		/// against external state (e.g., installed files); the first pattern that is fulfilled
		/// determines the returned type.
		/// 
		/// If no pattern is fulfilled, a default type if returned.
		/// </remarks>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns>The option type.</returns>
		/// <seealso cref="IOptionTypeResolver.ResolveOptionType(ConditionStateManager)"/>
		public OptionType ResolveOptionType(ConditionStateManager p_csmStateManager)
		{
			foreach (ConditionalTypePattern ctpPattern in m_lstPatterns)
				if (ctpPattern.Condition.GetIsFulfilled(p_csmStateManager))
					return ctpPattern.Type;
			return m_ptpDefaultType;
		}

		#endregion
	}
}
