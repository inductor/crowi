import { User } from 'client/types/crowi'
import { Me } from 'client/util/Crowi'

export const getUserPicture = (user?: User | Me) => user?.image || '/images/userpicture.png'
