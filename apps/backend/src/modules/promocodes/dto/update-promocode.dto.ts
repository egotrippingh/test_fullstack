import { PartialType } from '@nestjs/mapped-types';

import { CreatePromoCodeDto } from './create-promocode.dto';

export class UpdatePromoCodeDto extends PartialType(CreatePromoCodeDto) {}
