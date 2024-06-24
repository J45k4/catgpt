import { Model, models } from "../../models"

export const ModelSelect = (props: {
	model: Model
	onSetModel: (model: Model) => void
}) => {
	return (
		<select value={props.model} onChange={e => props.onSetModel(e.target.value as Model)}>
			<option disabled value="">Select a Model</option>
			{models.map((model) => {
				return (
					<option key={model}>
						{model}
					</option>
				)
			})}
		</select>
	)
}