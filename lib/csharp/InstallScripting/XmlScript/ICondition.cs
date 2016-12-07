using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// Defines the interface for a condition.
	/// </summary>
	public interface ICondition
	{
		/// <summary>
		/// Gets whether or not the condition is fulfilled.
		/// </summary>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns><c>true</c> if the condition is fulfilled;
		/// <c>false</c> otherwise.</returns>
		bool GetIsFulfilled(ConditionStateManager p_csmStateManager);

		/// <summary>
		/// Gets a message describing whether or not the condition is fulfilled.
		/// </summary>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns>A message describing whether or not the condition is fulfilled.</returns>
		string GetMessage(ConditionStateManager p_csmStateManager);
	}
}
