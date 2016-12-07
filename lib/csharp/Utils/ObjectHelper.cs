using System;
using System.Linq.Expressions;

namespace Utils
{
	public static class ObjectHelper
	{
		public static string GetPropertyName<T>(Expression<Func<T>> p_expProperty)
		{
			MemberExpression mexExpression;
			if (p_expProperty.Body is UnaryExpression)
			{
				UnaryExpression uexExpression = (UnaryExpression)p_expProperty.Body;
				mexExpression = (MemberExpression)uexExpression.Operand;
			}
			else
				mexExpression = (MemberExpression)p_expProperty.Body;
			return mexExpression.Member.Name;
		}

		public static string GetPropertyName<T>(Expression<Func<T, object>> p_expProperty)
		{
			MemberExpression mexExpression;
			if (p_expProperty.Body is UnaryExpression)
			{
				UnaryExpression uexExpression = (UnaryExpression)p_expProperty.Body;
				mexExpression = (MemberExpression)uexExpression.Operand;
			}
			else
				mexExpression = (MemberExpression)p_expProperty.Body;
			return mexExpression.Member.Name;
		}
	}
}
